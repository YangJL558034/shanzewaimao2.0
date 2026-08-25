"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, LockKeyhole, Plus, RefreshCw, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { getFreshCsrfToken } from "@/lib/csrf-client";

type Role = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { permission: { id: string; key: string; name: string } }[];
  _count: { users: number };
};
type User = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  lockedUntil: string | null;
  roles: { role: Role }[];
  _count: { sessions: number };
};
type Permission = { id: string; key: string; name: string };
type Modal = { type: "user" } | { type: "role" } | { type: "password"; user: User } | null;

export function SecurityManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/admin/security", { cache: "no-store", credentials: "same-origin" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "加载失败");
      return;
    }
    setUsers(data.users);
    setRoles(data.roles);
    setPermissions(data.permissions);
    setCurrentUserId(data.currentUserId);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function request(method: "POST" | "PUT" | "DELETE", body: Record<string, unknown>) {
    const csrf = await getFreshCsrfToken();
    const response = await fetch("/api/admin/security", {
      method,
      credentials: "same-origin",
      headers: { "content-type": "application/json", "x-csrf-token": csrf },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "操作失败");
    return data;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.type === "password") return;
    setBusy(true); setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(form);
    body.type = modal.type;
    if (modal.type === "role") body.permissionIds = form.getAll("permissionIds");
    try {
      await request("POST", body);
      setModal(null);
      setMessage(modal.type === "user" ? "管理员账号已创建" : "角色已创建");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally { setBusy(false); }
  }

  async function updateUser(id: string, body: Record<string, unknown>) {
    setError(""); setMessage("");
    try {
      await request("PUT", { type: "user", id, ...body });
      setMessage("账号状态已更新");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败"); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal.type !== "password") return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (password !== confirmation) { setError("两次输入的密码不一致"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await request("PUT", { type: "user", id: modal.user.id, password });
      setModal(null);
      if (result.signedOut) { location.href = "/admin/login"; return; }
      setMessage(`已修改 ${modal.user.name} 的密码，并注销该账号的全部 Session`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "密码修改失败"); }
    finally { setBusy(false); }
  }

  async function deleteUser(user: User) {
    if (user.id === currentUserId) { setError("不能删除当前登录账号"); return; }
    if (!confirm(`确认永久删除管理员“${user.name}”？该账号的 Session 和角色关联也会删除。`)) return;
    setError(""); setMessage("");
    try {
      await request("DELETE", { id: user.id });
      setMessage(`管理员 ${user.name} 已删除`);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); }
  }

  const locked = (user: User) => Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
  return (
    <>
      {error && <div className="form-status error mb-3">{error}</div>}
      {message && <div className="form-status success mb-3">{message}</div>}
      <div className="manager-stats">
        {[
          [Users, "管理员总数", users.length],
          [ShieldCheck, "启用账号", users.filter((user) => user.isActive).length],
          [LockKeyhole, "锁定账号", users.filter(locked).length],
          [KeyRound, "角色数量", roles.length],
        ].map(([Icon, label, value]) => {
          const C = Icon as typeof Users;
          return <div className="admin-panel manager-stat" key={String(label)}><div><small>{String(label)}</small><strong>{String(value)}</strong></div><span className="icon-badge"><C size={19}/></span></div>;
        })}
      </div>

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><h2>管理员管理</h2><p>真实账号状态、角色、密码与有效 Session</p></div>
          <div className="admin-toolbar">
            <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "role" })}><KeyRound size={14}/>新增角色</button>
            <button className="btn btn-primary btn-sm" onClick={() => setModal({ type: "user" })}><Plus size={14}/>新增管理员</button>
            <button className="icon-btn" onClick={load} aria-label="刷新"><RefreshCw size={14}/></button>
          </div>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>管理员</th><th>邮箱</th><th>角色</th><th>最后登录</th><th>Session</th><th>账号状态</th><th>操作</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.id}>
                <td><span className="admin-avatar mr-2 inline-grid">{user.name[0]}</span><strong>{user.name}</strong>{user.id === currentUserId && <small className="ml-2 text-brand-600">当前账号</small>}</td>
                <td>{user.email}</td>
                <td><select className="rounded border p-1" value={user.roles[0]?.role.id || ""} onChange={(event) => updateUser(user.id, { roleId: event.target.value })}>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></td>
                <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("zh-CN") : "从未登录"}</td>
                <td>{user._count.sessions}</td>
                <td><span className={`status-pill ${user.isActive ? "PUBLISHED" : "FAILED"}`}>{user.isActive ? "启用" : "停用"}</span>{locked(user) && <span className="status-pill FAILED ml-1">锁定</span>}</td>
                <td><div className="admin-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => setModal({ type: "password", user })}><KeyRound size={13}/>修改密码</button>
                  <button className="btn btn-outline btn-sm" onClick={() => updateUser(user.id, { isActive: !user.isActive })} disabled={user.id === currentUserId}>{user.isActive ? "停用" : "启用"}</button>
                  <button className="btn btn-outline btn-sm" onClick={() => updateUser(user.id, { unlock: true, revokeSessions: true })}>解锁/下线</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteUser(user)} disabled={user.id === currentUserId} title={user.id === currentUserId ? "当前登录账号不能删除" : "永久删除账号"}><Trash2 size={13}/>删除</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel mt-3">
        <div className="admin-panel-head"><div><h2>角色与权限矩阵</h2><p>权限在每个后台 API 中进行服务端校验</p></div></div>
        <div className="grid gap-3 p-4 md:grid-cols-3">{roles.map((role) => (
          <article className="card p-4" key={role.id}><div className="flex justify-between"><strong>{role.name}</strong><span className="status-pill">{role._count.users} 人</span></div><p className="text-xs text-slate-500">{role.description}</p><div className="flex flex-wrap gap-1">{role.permissions.slice(0, 8).map((item) => <span className="chip" key={item.permission.id}>{item.permission.key}</span>)}{role.permissions.length > 8 && <span className="chip">+{role.permissions.length - 8}</span>}</div></article>
        ))}</div>
      </section>

      {modal && <div className="modal-backdrop"><form className="admin-modal" onSubmit={modal.type === "password" ? changePassword : create}>
        <div className="modal-head"><h2>{modal.type === "user" ? "新增管理员" : modal.type === "role" ? "新增角色" : `修改 ${modal.user.name} 的密码`}</h2><button type="button" className="icon-btn" onClick={() => setModal(null)}><X size={16}/></button></div>
        <div className="modal-body"><div className="form-grid">
          {modal.type === "user" && <><div className="field"><label>真实姓名 *</label><input name="name" required/></div><div className="field"><label>邮箱 *</label><input name="email" type="email" required/></div><div className="field"><label>初始密码 *</label><input name="password" type="password" minLength={10} required/></div><div className="field"><label>角色 *</label><select name="roleId" required>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></div></>}
          {modal.type === "role" && <><div className="field"><label>角色名称 *</label><input name="name" required/></div><div className="field"><label>说明</label><input name="description"/></div><div className="field full"><label>分配权限</label><div className="grid grid-cols-2 gap-2 rounded border p-3 md:grid-cols-3">{permissions.map((permission) => <label className="flex gap-2 text-xs" key={permission.id}><input className="!w-auto" type="checkbox" name="permissionIds" value={permission.id}/>{permission.name}<small className="text-slate-400">{permission.key}</small></label>)}</div></div></>}
          {modal.type === "password" && <><div className="field full"><p className="rounded bg-amber-50 p-3 text-xs text-amber-800">保存后会立即注销该账号的所有登录 Session，需要使用新密码重新登录。</p></div><div className="field"><label>新密码 *</label><input name="password" type="password" minLength={10} autoComplete="new-password" required/></div><div className="field"><label>再次输入新密码 *</label><input name="confirmation" type="password" minLength={10} autoComplete="new-password" required/></div></>}
        </div></div>
        <div className="modal-foot"><button type="button" className="btn btn-outline btn-sm" onClick={() => setModal(null)}>取消</button><button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "正在保存…" : "保存到数据库"}</button></div>
      </form></div>}
    </>
  );
}
