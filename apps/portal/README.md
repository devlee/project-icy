# Portal（前台门户）

Next.js 静态导出站。内容来自 Studio「发布到门户」写出的 `content/portal/pack.json`（`PortalContentPack`）。

## 开发

```bash
# 先在 Studio 排期页导出门户包，再：
pnpm --filter portal dev     # http://localhost:3312
pnpm --filter portal build   # 输出 out/
```

可选环境变量：`ICY_CONTENT_ROOT`、`ICY_PORTAL_PACK`、`ICY_PORTAL_BRAND`（占位品牌名）。

图片 URL 在本地包中指向 Studio `/api/content/...`；上线前需换成 CDN/R2 地址或同源代理。
