<div align="center">
<img src="app/src-tauri/icons/icon-round.webp" width="96" />

<h1> Notademics</h1>

<strong>The Art of Minimal Markdown</strong>

</div>

Notademics is an open-source, lightweight, fully functional, and highly customizable Markdown Editor, now avaliable for Windows. Notademics is a refactoring and superset of [Typora](https://typora.io/) and [MarkText](https://github.com/marktext/marktext) . It will soon support AI features.

## Tech Stack

Frontend: Tauri / React / Typescript;

Backend: Rust;

WYSIWYG Engine: Muya;

## Screenshot

<img src=".\image\screenshot.png"/> 

## Features

- The WYSIWYG engine from [Muya](https://github.com/marktext/marktext) can perform Markdown rendering in real-time, providing an elegant writing experience. 

- Supports [all themes of Marktext](https://marktext.me/docs/themes) , and allows customization of image backgrounds on this basis;

## Typora replication

This repository now carries a Typora-parity pass built from static analysis of
the shipped Typora 1.14.9 application:

- Typora's five bundled themes (`github`, `night`, `newsprint`, `pixyll`,
  `whitey`) ported onto the Muya writing surface, with `github` as the default
  theme and `night` as the default dark theme;
- a Typora-style footer: sidebar / source-code / focus / typewriter / read-only
  toggles on the left, and a Typora word-count popover (reading time, lines,
  words, characters, selection counts) on the right;
- Typora writing modes wired to `Ctrl+/` (source), `F8` (focus) and `F9`
  (typewriter), with a menu-only read-only mode;
- a menu bar shaped like Typora's File / Edit / Paragraph / Format / View /
  Themes / Window / Help menus, including a `Typora Themes` group.

See [docs/typora-clone.md](docs/typora-clone.md) for the evidence trail, the
architecture mapping and the known deviations.

## Installation, Build & Deployment

```bash
cd app
npm install
npm run tauri build
```

> Before running, make sure you have installed [Rust](https://www.rust-lang.org/) (stable) , [Node.js](https://nodejs.org/) (≥ 20) and [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) .

## Development

Notademics is a product of vibe programming, and I cannot guarantee its product usability. If you find any bugs or vulnerabilities, or wish to implement new features, you can raise an issue, and I will evaluate and implement them accordingly. If you wish to implement them yourself, you are welcome to fork or submit a pull request.

## License

<img src=".\image\gnu.svg" alt="GNU Head" style="width: 10%;" /> [GNU GPL 3.0](https://gnu.net.cn/licenses/gpl-3.0.html)
