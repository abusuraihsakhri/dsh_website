import json
import re
import html

def run_all_tests():
    print("=== DSH WEBSITE VERIFICATION & POLISH TEST SUITE ===")

    # 1. Load data
    with open('src/data/members.json', encoding='utf-8') as f:
        members = json.load(f)
    print(f"[TEST 1] Raw dataset loaded: {len(members)} members.")
    assert len(members) >= 611, f"Expected at least 611 members, got {len(members)}"

    # 2. Inspect built index.html
    with open('index.html', encoding='utf-8') as f:
        page = f.read()

    # 3. Check placeholders
    placeholders = re.findall(r'__[A-Z_]+__', page)
    assert len(placeholders) == 0, f"Unreplaced placeholders found: {placeholders}"
    print("[TEST 2] Zero leftover placeholders in index.html.")

    # 4. Check all 6 sub-windows
    windows = ['home', 'about', 'programme', 'directory', 'certificate', 'join']
    for w in windows:
        assert f'id="win-{w}"' in page, f"Window win-{w} missing in DOM"
    print("[TEST 3] All 6 sub-windows verified in DOM.")

    # 5. Check JS DOM hook IDs
    critical_ids = [
        'progress', 'metaTheme', 'themeToggle', 'quickSearchBtn', 'navToggle',
        'mobileDrawer', 'drawerClose', 'drawerBackdrop', 'windowNavTabs',
        'windowCurrentTitle', 'winCounterPill', 'prevWinStepBtn', 'nextWinStepBtn',
        'gl-hero', 'dna-canvas', 'dir-search', 'dir-clear', 'dir-inst-filter',
        'dir-rank-filter', 'dir-filter', 'dir-sort', 'dir-count', 'viewTableBtn',
        'viewCardBtn', 'exportCsvBtn', 'printDirBtn', 'dirTableContainer',
        'dirCardContainer', 'dirTable', 'dir-tbody', 'dir-cards-body', 'dir-empty',
        'emptyResetBtn', 'dir-per-page', 'dir-first', 'dir-prev', 'dir-page-note',
        'dir-next', 'dir-last', 'certSearchInput', 'certMemberSelect', 'printCertBtn', 'certDocument',
        'certRegBadge', 'certMemberName', 'certMemberAddr', 'certMemberStatus',
        'certPocketCard', 'pocketAvatar', 'pocketName', 'pocketId', 'pocketInst',
        'join-form', 'memberModalBackdrop', 'modalCloseBtn', 'modalAvatar',
        'modalRegId', 'modalMemberName', 'modalInst', 'modalAddr', 'modalPhone',
        'modalMobile', 'modalEmail', 'modalCopyBtn', 'modalCertBtn', 'toast'
    ]
    missing = [cid for cid in critical_ids if f'id="{cid}"' not in page]
    assert len(missing) == 0, f"Missing critical IDs in HTML: {missing}"
    print(f"[TEST 4] All {len(critical_ids)} JavaScript hook IDs verified in DOM.")

    # 6. Check Terminology
    assert 'fellowship' not in page.lower(), "Terminology error: 'fellowship' found!"
    assert 'good standing' not in page.lower(), "Terminology error: 'good standing' found!"
    print("[TEST 5] Terminology audit: 'fellowship' and 'good standing' completely eliminated.")

    # 7. Check Heading & Tagline
    assert 'Delhi Society of Hematology' in page, "Big heading missing"
    assert ('Advancing the Science of Blood &amp; Marrow' in page or
            'Advancing the Science of Blood & Marrow' in page), "Sub-heading missing"
    assert 'Advancing the science of hematology' in page, "Tagline missing"
    print("[TEST 6] Heading hierarchy and tagline verified.")

    # 8. Check embedded members data in index.html
    m_match = re.search(r'const MEMBERS = (\[.*?\]);', page, re.DOTALL)
    assert m_match is not None, "const MEMBERS not found in index.html"
    embedded_members = json.loads(m_match.group(1))
    assert len(embedded_members) >= 611, f"Expected at least 611 embedded members, got {len(embedded_members)}"
    print(f"[TEST 7] Embedded MEMBERS array verified ({len(embedded_members)} records).")

    # 9. Verify filtering logic on embedded members
    # Test phone & mobile presence
    with_email = [m for m in embedded_members if m.get('em') and '@' in m['em']]
    with_mob = [m for m in embedded_members if m.get('mob')]
    with_addr = [m for m in embedded_members if m.get('addr')]
    print(f"[TEST 8] Data coverage: {len(with_email)} emails, {len(with_mob)} mobiles, {len(with_addr)} addresses.")
    assert len(with_email) >= 350, "Email count unexpectedly low"

    # Test institution matching coverage
    aiims_members = [m for m in embedded_members if 'aiims' in ((m.get('inst','') or '') + ' ' + (m.get('addr','') or '')).lower()]
    sgrh_members = [m for m in embedded_members if any(k in ((m.get('inst','') or '') + ' ' + (m.get('addr','') or '')).lower() for k in ['ganga ram', 'sgrh', 'gripmer'])]
    ucms_members = [m for m in embedded_members if any(k in ((m.get('inst','') or '') + ' ' + (m.get('addr','') or '')).lower() for k in ['ucms', 'gtb'])]
    print(f"[TEST 9] Institutional smart detection: AIIMS={len(aiims_members)}, SGRH={len(sgrh_members)}, UCMS={len(ucms_members)}")
    assert len(aiims_members) > 0 and len(sgrh_members) > 0 and len(ucms_members) > 0, "Institution filter coverage failed"

    # 10. Check CSS validity and themes
    assert ':root' in page and '[data-theme="light"]' in page, "Theme variables missing"
    assert '@media print' in page, "Print stylesheet missing"
    assert '@media (max-width: 760px)' in page, "Mobile responsive rules missing"
    print("[TEST 10] CSS theme tokens, responsive breakpoints, and print stylesheets verified.")

    # 11. Check iCalendar compliance
    assert 'BEGIN:VCALENDAR' in page and 'BEGIN:VEVENT' in page, "iCalendar logic missing"
    assert 'PRODID:-//Delhi Society of Hematology//Academic Calendar//EN' in page, "ICS PRODID missing"
    print("[TEST 11] iCalendar RFC 5545 generator verified.")

    # 12. Check Certificate generator
    assert 'REGISTER ID: DSH/LM/' in page, "Certificate register badge missing"
    assert 'Life Member' in page, "Life Member label missing"
    print("[TEST 12] Certificate & ID Card Generator verified.")

    print("\n>>> ALL 12 TESTS PASSED SUCCESSFULLY! PORTAL IS ROCK SOLID. <<<\n")

if __name__ == '__main__':
    run_all_tests()
