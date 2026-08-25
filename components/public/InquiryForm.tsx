"use client";

import { FormEvent, useEffect, useState } from "react";
import { Send, UploadCloud } from "lucide-react";

export function InquiryForm({ categories, locale = "en", heading, intro, submitLabel }: { categories: { id: string; name: string }[]; locale?: string; heading?: string; intro?: string; submitLabel?: string }) {
  const zh = locale === "zh";
  const [csrf, setCsrf] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/csrf")
      .then((response) => response.json())
      .then((data) => setCsrf(data.token))
      .catch(() => setStatus({ type: "error", message: zh ? "安全表单初始化失败，请刷新页面。" : "Unable to initialize the secure form. Please refresh." }));
  }, [zh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "x-csrf-token": csrf },
        body: new FormData(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (zh ? "询盘发送失败" : "Unable to send inquiry"));
      setStatus({ type: "success", message: zh ? `感谢您，询盘 ${data.referenceNo} 已安全入库，我们会尽快联系您。` : `Thank you. Your inquiry ${data.referenceNo} has been saved. Our team will contact you shortly.` });
      form.reset();
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : zh ? "询盘发送失败" : "Unable to send inquiry" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card form-card" onSubmit={submit} encType="multipart/form-data">
      <h2 className="section-title !text-2xl">{heading || (zh ? "发送消息 / 获取报价" : "Send Us a Message / Get a Quote")}</h2>
      <p className="muted">{intro || (zh ? "带 * 的字段为必填项。询盘会先安全入库，再发送通知邮件。" : "Fields marked * are required. Your inquiry is securely stored before any notification email is sent.")}</p>
      {status && <div role="status" className={`form-status ${status.type}`}>{status.message}</div>}
      <div className="form-grid mt-5">
        <div className="field"><label htmlFor="fullName">{zh ? "姓名 *" : "Full Name *"}</label><input id="fullName" name="fullName" required maxLength={100} autoComplete="name" placeholder={zh ? "您的姓名" : "Your full name"} /></div>
        <div className="field"><label htmlFor="companyName">{zh ? "公司名称 *" : "Company Name *"}</label><input id="companyName" name="companyName" required maxLength={150} autoComplete="organization" placeholder={zh ? "您的公司名称" : "Your company name"} /></div>
        <div className="field"><label htmlFor="email">{zh ? "电子邮箱 *" : "Email Address *"}</label><input id="email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="name@company.com" /></div>
        <div className="field"><label htmlFor="phone">{zh ? "电话 / WhatsApp" : "Phone / WhatsApp"}</label><input id="phone" name="phone" maxLength={50} autoComplete="tel" placeholder="+86 138 0000 0000" /></div>
        <div className="field full"><label htmlFor="country">{zh ? "国家 / 地区 *" : "Country / Region *"}</label><input id="country" name="country" required maxLength={100} autoComplete="country-name" placeholder={zh ? "您的国家或地区" : "Your country or region"} /></div>
        <div className="field full"><label htmlFor="productInterest">{zh ? "感兴趣的产品 *" : "Product Interest *"}</label><select id="productInterest" name="productInterest" required defaultValue=""><option value="" disabled>{zh ? "请选择产品分类" : "Select product category"}</option>{categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></div>
        <div className="field full"><label htmlFor="message">{zh ? "项目需求详情 *" : "Message / Project Details *"}</label><textarea id="message" name="message" required minLength={20} maxLength={5000} placeholder={zh ? "请说明产品需求、目标市场、采购数量、交期、认证与定制要求。" : "Tell us about requirements, target market, order quantity, timeline, certifications and customization needs."} /></div>
        <div className="field full"><label htmlFor="files">{zh ? "上传资料（可选）" : "Upload Documents (Optional)"}</label><div className="upload-drop"><UploadCloud className="mx-auto text-brand-600" /><input id="files" name="files" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.docx" /><small className="block text-slate-500">PDF、DOCX、XLSX、JPG、PNG 或 WEBP · {zh ? "每个文件最大 10MB" : "Max 10MB each"}</small></div></div>
        <div className="hidden" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <div className="field full"><label className="flex items-start gap-2 font-normal"><input className="!w-auto mt-1" name="consent" type="checkbox" value="yes" required />{zh ? "我同意隐私政策，并授权网站使用这些信息回复询盘。" : "I agree to the Privacy Policy and consent to ENERCORE using this information to respond to my inquiry."}</label></div>
        <div className="field full items-end"><button disabled={busy || !csrf} className="btn btn-primary ml-auto" type="submit">{busy ? (zh ? "正在保存…" : "Saving...") : submitLabel || (zh ? "提交询盘" : "Send Inquiry")}<Send size={16} /></button></div>
      </div>
    </form>
  );
}
