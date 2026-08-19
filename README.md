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
