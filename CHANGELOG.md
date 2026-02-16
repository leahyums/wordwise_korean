# Changelog

All notable changes to WordWise Korean will be documented in this file.

## [0.1.0] - 2026-02-16

### Initial Release

A browser extension that adds Kindle Word Wise style annotations for Korean language learning.

### Features

- **Complete TOPIK I + II Vocabulary**: 4,341 words imported from official TOPIK materials
  - TOPIK I: 1,578 words (beginner level)
  - TOPIK Ⅱ: 2,729 words (intermediate/advanced level)
- **Smart Conjugation Matching**: Handles Korean verb and adjective conjugations
  - Stem extraction algorithm with 30+ ending patterns
  - Supports 다-form, 요-form, 어/아-form, ㄴ/은-form, and more
- **Grammar Particle Filtering**: Excludes 20+ common particles (은/는/이/가/을/를/의/도/etc.)
  - Prevents cluttering text with functional words
  - Focuses on vocabulary learning
- **Three Vocabulary Levels**: 
  - TOPIK I only
  - TOPIK Ⅱ only  
  - All levels combined
- **Multiple Translation Languages**: English, Chinese (placeholder), Japanese (placeholder)
- **Ruby Tag Annotations**: Translations appear directly above Korean words
  - Always visible, no hover needed
  - Semantic HTML5 elements
- **Dynamic Content Support**: Works on modern websites
  - MutationObserver for SPA support
  - Debounced processing (500ms)
  - Infinite scroll compatible
- **Optional Highlighting**: Visual background for annotated words
- **Privacy-Focused**: All processing happens locally
  - No data collection
  - No external API calls
  - Settings stored in Chrome sync

### Technical Features

- Built with WXT framework for modern extension development
- Vue 3 + TypeScript for popup UI
- Chrome Manifest V3 compliant
- WeakSet-based processed node tracking
- Position-based overlap detection
- Longest-word-first matching algorithm

### Documentation

- Comprehensive README with setup and usage instructions
- Installation guide (INSTALL.md) for end users
- Developer documentation (DEVELOPMENT.md)
- Vocabulary customization guide (data/README.md)
- Script documentation for vocabulary management

### Vocabulary Management Scripts

- **pdf-to-vocab.js**: Parse PDF text to JSON with line-by-line parsing
- **csv-to-vocab.js**: Convert CSV files to vocabulary JSON
- **batch-translate.js**: AI-powered translation for missing languages

### Known Issues

- Chinese and Japanese translations are currently placeholders (English-based)
- Chrome may disable developer mode extensions on restart (expected behavior)
- Some dynamic sites may require page refresh after changing settings

---

## Version Numbering

- **Major** (X.0.0): Breaking changes, major feature additions
- **Minor** (0.X.0): New features, non-breaking changes
- **Patch** (0.0.X): Bug fixes, minor improvements
