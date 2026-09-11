# Delhi Society of Hematology — Official Portal

🌐 **Live Website (GitHub Pages):**  
👉 **[https://abusuraihsakhri.github.io/dsh_website/](https://abusuraihsakhri.github.io/dsh_website/)**

---

Official membership register and academic portal of the **Delhi Society of Hematology (DSH)**, established in 1989.

## 🔗 Quick Links
- **Live Portal:** [https://abusuraihsakhri.github.io/dsh_website/](https://abusuraihsakhri.github.io/dsh_website/)
- **Member Register:** 915 Life Members across premier medical institutions (AIIMS, SGRH, MAMC, UCMS, etc.)
- **Academic Programme:** Quarterly CMEs, Annual Conferences, and Webinars
- **Certificate Suite:** Life Membership Certificates & Pocket ID Cards

## ✨ Features
- **915 Life Members Register:** Instant search, department/institution filtering, multi-field query, and CSV export.
- **WebGL Blood Stream 3D Hero:** Custom real-time shader rendering red blood cells, white blood cells, platelets, and plasma.
- **Dynamic Certificate & ID Card Generator:** Print-ready official membership certificates and digital pocket credential cards.
- **Academic Calendar & CME Programme:** Event dates, chairpersons, topics, and RFC 5545 iCalendar (`.ics`) integration.
- **Dark & Light Mode:** Seamless obsidian/slate and ivory/ink palettes with automatic system preference detection.
- **Mobile-First Responsive Design:** Clean layout for all smartphone and tablet viewports with a slide-out drawer menu.

## 🏗️ Architecture & Single-File Distribution
The entire production portal compiles into a single, high-performance, self-contained `index.html` file (~340 KB) with zero external script or CSS dependencies.

### Project Structure
- `src/template.html` — HTML shell and markup structure
- `src/style.css` — Modern design system and responsive styles
- `src/app.js` — Single-page application logic and WebGL canvas engine
- `src/data/members.json` — 915 verified life member records
- `src/build.py` — Production assembly pipeline
- `tests/run_tests.py` — Automated verification test suite (12 assertions)

### Building from Source
```bash
python src/build.py
python tests/run_tests.py
```

Outputs `index.html` in the project root.

## 📜 License & Governance
Institutional use — **Delhi Society of Hematology (DSH)**. Est. 1989.
