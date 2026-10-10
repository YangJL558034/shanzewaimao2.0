/**
 * Nginx proxy_cache purge utility
 * 清除 Nginx 代理缓存，确保后台数据修改后前台立即更新
 * 
 * 采用直接删除缓存文件的方式（更可靠）
 */

import { execSync } from "node:child_process";

const CACHE_DIRS = [
  "/www/wwwroot/www.shanzesz.com/proxy_cache_dir",
  "/www/wwwroot/shanzesz.com/proxy_cache_dir",
];

const HOSTS = ["www.shanzesz.com", "shanzesz.com"];

/**
 * Purge a specific URL from Nginx proxy cache
 * Note: Due to nginx's multi-level hash directory structure,
 * we wipe the entire cache for reliability. The 30s TTL
 * means this is acceptable for infrequent admin saves.
 */
export async function purgeUrl(_path: string): Promise<void> {
  // Wipe all cache files - the 30s TTL means this is safe
  for (const cacheDir of CACHE_DIRS) {
    try {
      execSync(`find ${cacheDir} -type f -delete 2>/dev/null`, { 
        stdio: "pipe",
        timeout: 5000,
      });
    } catch {
      // Ignore errors - cache may already be empty
    }
  }
}

/**
 * Purge all common frontend pages after admin data changes
 */
export async function purgeFrontendCache(): Promise<void> {
  // Simply wipe all proxy cache files
  for (const cacheDir of CACHE_DIRS) {
    try {
      execSync(`find ${cacheDir} -type f -delete 2>/dev/null`, { 
        stdio: "pipe",
        timeout: 5000,
      });
    } catch {
      // Ignore errors
    }
  }
}

/**
 * Purge pages related to a specific content type
 */
export async function purgeContentCache(_type: string): Promise<void> {
  // Just wipe all cache - it's simpler and more reliable
  // The 30s TTL means the cache will repopulate quickly
  await purgeFrontendCache();
}
