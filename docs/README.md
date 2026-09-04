# Notademics 文档站

本站使用 Jekyll 构建，源文件位于仓库的 `docs/` 目录。推送到 `main` 分支后，
`.github/workflows/pages.yml` 会自动构建并部署 GitHub Pages。

本地预览：

```bash
cd docs
bundle install
bundle exec jekyll serve --baseurl ""
```

然后访问 `http://127.0.0.1:4000`。

