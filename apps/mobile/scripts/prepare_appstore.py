#!/usr/bin/env python3
import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request

import jwt

BASE = 'https://api.appstoreconnect.apple.com/v1'
APP_ID = '6815222355'
VERSION_ID = 'c644630a-469a-4a78-afef-fbd6c6d8fb5c'
APP_INFO_ID = '71aa32a7-2b8b-4689-9a41-ccdf5fb0a11f'
VERSION_LOC_ID = '3b8450e4-cdb3-46cc-a885-a8193c843f6d'
APP_INFO_LOC_ID = '6b2de77d-feef-4665-9f50-1731c772bdef'
BUILD_ID = '1d88982c-5f20-4f76-9c91-482c3308adeb'
ROOT = Path(__file__).resolve().parents[1]
SCREENSHOT_DIR = ROOT / 'assets' / 'appstore'


def token():
    p8 = Path(os.environ['EXPO_ASC_API_KEY_PATH']).read_text()
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ['EXPO_ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
        p8,
        algorithm='ES256',
        headers={'kid': os.environ['EXPO_ASC_KEY_ID'], 'typ': 'JWT'},
    )


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {'Authorization': 'Bearer ' + token(), 'Accept': 'application/json'}
    if body is not None:
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(BASE + path, headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(r, timeout=90) as resp:
            text = resp.read().decode()
            return resp.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors='replace')
        try:
            j = json.loads(text)
        except Exception:
            j = {'raw': text}
        return e.code, j


def must(method, path, body=None, ok=(200, 201, 204)):
    st, data = req(method, path, body)
    if st not in ok:
        raise RuntimeError(f'{method} {path} -> {st}: {json.dumps(data)[:3000]}')
    return data


def set_metadata():
    must('PATCH', f'/apps/{APP_ID}', {
        'data': {'type': 'apps', 'id': APP_ID, 'attributes': {'contentRightsDeclaration': 'DOES_NOT_USE_THIRD_PARTY_CONTENT'}}
    })
    must('PATCH', f'/appStoreVersions/{VERSION_ID}', {
        'data': {'type': 'appStoreVersions', 'id': VERSION_ID, 'attributes': {
            'copyright': '© 2026 EuroVentro',
            'releaseType': 'AFTER_APPROVAL',
            'usesIdfa': False,
        }}
    })
    must('PATCH', f'/appInfoLocalizations/{APP_INFO_LOC_ID}', {
        'data': {'type': 'appInfoLocalizations', 'id': APP_INFO_LOC_ID, 'attributes': {
            'name': 'ElektroPrice',
            'subtitle': 'Live electricity prices',
            'privacyPolicyUrl': 'https://elektoprice.lv/privacy',
        }}
    })
    description = (
        'ElektroPrice helps you check live electricity prices and choose cheaper times to use power.\n\n'
        'See current €/kWh prices for connected Nord Pool markets, compare today\'s price level, and estimate how much running an appliance such as a dryer will cost.\n\n'
        'Features:\n'
        '• Live electricity prices for supported Nord Pool areas\n'
        '• Simple price status: cheap, normal or expensive\n'
        '• Dryer/appliance cost estimate\n'
        '• Cheapest upcoming usage windows\n'
        '• Price gauge and chart\n'
        '• Latvia, Lithuania, Estonia, Russian and English languages\n\n'
        'ElektroPrice is made for quick everyday decisions: check the price now, then use electricity when it is cheaper.'
    )
    must('PATCH', f'/appStoreVersionLocalizations/{VERSION_LOC_ID}', {
        'data': {'type': 'appStoreVersionLocalizations', 'id': VERSION_LOC_ID, 'attributes': {
            'promotionalText': 'Live electricity prices and cheaper usage times.',
            'description': description,
            'keywords': 'electricity,energy,prices,Nord Pool,power,kWh,dryer,utility,savings,Europe',
            'supportUrl': 'https://elektoprice.lv',
            'marketingUrl': 'https://elektoprice.lv',
        }}
    })
    # Category is exposed by ASC as read-only for this API key/app state; keep going if Apple refuses it.
    for rel, cat in [('primaryCategory', 'UTILITIES'), ('secondaryCategory', 'FINANCE')]:
        st, data = req('PATCH', f'/appInfos/{APP_INFO_ID}/relationships/{rel}', {
            'data': {'type': 'appCategories', 'id': cat}
        })
        if st not in (200, 204):
            print(f'category {rel} not updated via API:', st, json.dumps(data)[:400])
    # Ensure build is attached.
    must('PATCH', f'/appStoreVersions/{VERSION_ID}/relationships/build', {
        'data': {'type': 'builds', 'id': BUILD_ID}
    }, ok=(204,))
    # Create/update review detail. The app has no account system, so no login needed.
    st, current = req('GET', f'/appStoreVersions/{VERSION_ID}/appStoreReviewDetail')
    attrs = {
        'contactFirstName': 'EuroVentro',
        'contactLastName': 'Support',
        'contactPhone': '+371 20287899',
        'contactEmail': 'support@euroventro.com',
        'demoAccountRequired': False,
        'notes': 'ElektroPrice does not require sign-in. Open the app, choose a market, and the app loads live electricity price data from the production backend at https://elektoprice.lv / DigitalOcean backend. The app does not use IDFA and does not include in-app purchases.',
    }
    if st == 200 and current.get('data'):
        rid = current['data']['id']
        must('PATCH', f'/appStoreReviewDetails/{rid}', {'data': {'type': 'appStoreReviewDetails', 'id': rid, 'attributes': attrs}})
    else:
        body = {'data': {'type': 'appStoreReviewDetails', 'attributes': attrs, 'relationships': {'appStoreVersion': {'data': {'type': 'appStoreVersions', 'id': VERSION_ID}}}}}
        st2, d2 = req('POST', '/appStoreReviewDetails', body)
        if st2 not in (200, 201):
            print('review detail create skipped/failed', st2, json.dumps(d2)[:1200])


def list_sets():
    st, data = req('GET', f'/appStoreVersionLocalizations/{VERSION_LOC_ID}/appScreenshotSets?limit=50')
    if st != 200:
        raise RuntimeError(data)
    return data.get('data', [])


def get_or_create_set(display_type):
    for s in list_sets():
        if s.get('attributes', {}).get('screenshotDisplayType') == display_type:
            return s['id']
    body = {'data': {'type': 'appScreenshotSets', 'attributes': {'screenshotDisplayType': display_type}, 'relationships': {'appStoreVersionLocalization': {'data': {'type': 'appStoreVersionLocalizations', 'id': VERSION_LOC_ID}}}}}
    st, data = req('POST', '/appScreenshotSets', body)
    if st not in (200, 201):
        raise RuntimeError(f'create screenshot set {display_type}: {st} {json.dumps(data)[:2000]}')
    return data['data']['id']


def clear_set(set_id):
    st, data = req('GET', f'/appScreenshotSets/{set_id}/appScreenshots?limit=50')
    if st != 200:
        raise RuntimeError(data)
    for shot in data.get('data', []):
        must('DELETE', f'/appScreenshots/{shot["id"]}', ok=(204,))


def upload_file(set_id, path, order):
    raw = path.read_bytes()
    md5 = hashlib.md5(raw).digest()
    checksum_b64 = base64.b64encode(md5).decode()
    body = {'data': {'type': 'appScreenshots', 'attributes': {'fileName': path.name, 'fileSize': len(raw)}, 'relationships': {'appScreenshotSet': {'data': {'type': 'appScreenshotSets', 'id': set_id}}}}}
    st, data = req('POST', '/appScreenshots', body)
    if st not in (200, 201):
        raise RuntimeError(f'create screenshot {path.name}: {st} {json.dumps(data)[:2000]}')
    sid = data['data']['id']
    ops = data['data']['attributes']['uploadOperations']
    for op in ops:
        offset = int(op.get('offset', 0)); length = int(op.get('length', len(raw)))
        headers = {h['name']: h['value'] for h in op.get('requestHeaders', [])}
        # Apple upload URLs already include auth; do not attach ASC bearer token.
        chunk = raw[offset:offset+length]
        r = urllib.request.Request(op['url'], data=chunk, headers=headers, method=op.get('method', 'PUT'))
        with urllib.request.urlopen(r, timeout=180) as resp:
            resp.read()
    # Mark uploaded. Try checksum first, fall back to uploaded only.
    patch_body = {'data': {'type': 'appScreenshots', 'id': sid, 'attributes': {'uploaded': True, 'sourceFileChecksum': checksum_b64}}}
    st2, d2 = req('PATCH', f'/appScreenshots/{sid}', patch_body)
    if st2 not in (200, 204):
        patch_body = {'data': {'type': 'appScreenshots', 'id': sid, 'attributes': {'uploaded': True}}}
        st2, d2 = req('PATCH', f'/appScreenshots/{sid}', patch_body)
    if st2 not in (200, 204):
        raise RuntimeError(f'commit screenshot {path.name}: {st2} {json.dumps(d2)[:2000]}')
    # App Store normally orders by creation; display order is not supported in this API version.
    return sid


def upload_screenshots():
    groups = [
        ('APP_IPHONE_67', [SCREENSHOT_DIR/'iphone_01_price.png', SCREENSHOT_DIR/'iphone_02_markets.png', SCREENSHOT_DIR/'iphone_03_savings.png']),
        ('APP_IPAD_PRO_3GEN_129', [SCREENSHOT_DIR/'ipad_01_overview.png', SCREENSHOT_DIR/'ipad_02_savings.png']),
    ]
    for display, files in groups:
        set_id = get_or_create_set(display)
        clear_set(set_id)
        print('uploading', display, 'set', set_id)
        for i, p in enumerate(files, 1):
            sid = upload_file(set_id, p, i)
            print(' ', p.name, sid)

if __name__ == '__main__':
    set_metadata()
    upload_screenshots()
    print('done')
