<div align="center">

# 🎨 Token Studio

**Transform JSON across multiple formats and analyze token usage**

[![Next.js](https://img.shields.io/badge/Next.js-16.0-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38bdf8?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

## ✨ Features

- 🔄 **Multi-Format Conversion**: Convert JSON to Pretty JSON, Minified JSON, YAML, TOON, and TOML
- 🎯 **Token Analysis**: Real-time token counting using OpenAI's `cl100k_base` tokenizer
- 📊 **Token Visualization**: Highlight tokens with color-coded display
- 🧠 **Token-Aware Formatting**: Optimize output by removing unnecessary quotes from simple strings
- 📈 **Count Comparison**: Compare character, byte, and token counts across all formats
- 📋 **Copy-Ready Outputs**: One-click copy for any format
- 🎨 **Modern UI**: Beautiful, responsive interface built with Radix UI and Tailwind CSS
- 🌓 **Dark Mode**: Built-in theme support

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm (or npm/yarn)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/tokentools.git
cd tokentools

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
# Build the application
pnpm build

# Start production server
pnpm start
```

## 📖 Usage

1. **Input JSON**: Paste or type your JSON in the input field on the left
2. **Choose Format**: Select from five output formats:
   - **Original JSON**: Pretty-printed with indentation
   - **Minified JSON**: Compact single-line format
   - **YAML**: Human-readable YAML format
   - **TOON**: Compact TOON encoding format
   - **TOML**: TOML configuration format
3. **Enable Features**:
   - **Token Aware**: Remove quotes from simple strings to optimize token count
   - **Show Tokens**: Visualize tokens with color highlighting
   - **Show Counts**: Display character, byte, and token counts
   - **Copy-Ready**: Enable copy buttons for quick access
4. **Analyze**: Compare token usage across different formats to find the most efficient encoding

## 🛠️ Tech Stack

<div align="center">

| Category | Technology |
|----------|-----------|
| **Framework** | ![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat-square&logo=next.js) Next.js 16 |
| **UI Library** | ![React](https://img.shields.io/badge/-React-61DAFB?style=flat-square&logo=react) React 19 |
| **Language** | ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat-square&logo=typescript) TypeScript 5 |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css) Tailwind CSS 4 |
| **UI Components** | ![Radix UI](https://img.shields.io/badge/-Radix%20UI-161618?style=flat-square) Radix UI |
| **Tokenization** | ![TikToken](https://img.shields.io/badge/-TikToken-000000?style=flat-square) @dqbd/tiktoken |
| **Icons** | ![Lucide](https://img.shields.io/badge/-Lucide-FF6B6B?style=flat-square) Lucide React |
| **Formats** | TOON, TOML, YAML |

</div>

## 📁 Project Structure

```
tokentools/
├── app/
│   ├── api/
│   │   └── tokenize/        # Tokenization API endpoint
│   ├── page.tsx             # Main application page
│   └── layout.tsx           # Root layout
├── components/
│   ├── token-studio/        # Token studio components
│   └── ui/                  # Reusable UI components
├── lib/
│   ├── types.ts             # TypeScript type definitions
│   └── utils/               # Utility functions
│       ├── json.ts          # JSON/YAML conversion
│       ├── toml.ts          # TOML conversion
│       ├── toon.ts          # TOON encoding
│       └── tokenization.ts  # Token utilities
└── hooks/
    └── use-tokenization.ts  # Tokenization hook
```

## 🎯 Key Features Explained

### Token-Aware Formatting
When enabled, removes unnecessary quotes from simple strings (e.g., `"hello"` → `hello`) to reduce token count while maintaining valid syntax.

### Token Visualization
Color-coded token highlighting helps you understand how your data is tokenized. Each unique token gets a distinct color based on its ID.

### Format Comparison
Compare the same data across five different formats to find the most token-efficient encoding for your use case.

## 🐛 Reporting Issues

Found a bug or have a feature request? Please open an issue on GitHub:

🔗 **[Create an Issue](https://github.com/yourusername/tokentools/issues/new)**

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and OS information
- Screenshots (if applicable)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**MIT License** - You are free to use, modify, and distribute this software for any purpose, including commercial use.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License Summary

```
MIT License

Copyright (c) 2024 Token Studio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<div align="center">

Made with ❤️ using Next.js and React

⭐ Star this repo if you find it useful!

</div>
