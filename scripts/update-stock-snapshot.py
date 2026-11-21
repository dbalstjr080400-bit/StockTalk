#!/usr/bin/env python3
"""Build the public fallback directory from KIS master files.

This is not a Toss Securities tradability list. Run manually when a new
snapshot is wanted: python3 scripts/update-stock-snapshot.py
The files are published at https://apiportal.koreainvestment.com/apiservice-category.
"""
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import json
import re
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'client/public/data/stock-snapshot.json'
BASE = 'https://new.real.download.dws.co.kr/common/master/'


def download(name):
    req = urllib.request.Request(BASE + name, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=40) as response:
        data = response.read()
    with zipfile.ZipFile(BytesIO(data)) as archive:
        files = [n for n in archive.namelist() if not n.endswith('/')]
        if len(files) != 1:
            raise ValueError(f'Unexpected archive structure: {name}')
        return archive.read(files[0]).decode('cp949')


def korean(market, name, tail_length):
    result = []
    for line in download(name).splitlines(keepends=True):
        head, tail = line[:-tail_length], line[-tail_length:]
        symbol = head[:9].strip()
        korean_name = head[21:].strip()
        group = tail[:2]
        # Exclude funds and derivatives that are not stocks/ETPs.
        if not re.fullmatch(r'[0-9A-Z]{6}', symbol) or not korean_name:
            continue
        if group not in {'ST', 'FS', 'DR', 'RT', 'IF', 'EF'}:
            continue
        kind = {'EF': 'ETF/ETN', 'RT': '리츠', 'IF': '인프라펀드', 'DR': 'DR'}.get(group, '주식')
        result.append({'symbol': symbol, 'name': korean_name, 'market': market, 'type': kind})
    return result


def american(market, archive):
    result = []
    for line in download(archive).splitlines():
        fields = line.split('\t')
        if len(fields) < 9 or fields[0] != 'US' or fields[8] not in {'2', '3'}:
            continue
        symbol, name, english = (fields[i].strip() for i in (4, 6, 7))
        if not symbol or not name:
            continue
        result.append({'symbol': symbol, 'name': name, 'englishName': english,
                       'market': market, 'type': 'ETF/ETN' if fields[8] == '3' else '주식'})
    return result


def main():
    items = []
    items += korean('KOSPI', 'kospi_code.mst.zip', 228)
    items += korean('KOSDAQ', 'kosdaq_code.mst.zip', 222)
    for market, archive in [('NASDAQ', 'nasmst.cod.zip'), ('NYSE', 'nysmst.cod.zip'), ('AMEX', 'amsmst.cod.zip')]:
        items += american(market, archive)
    unique = {(item['market'], item['symbol']): item for item in items}
    items = sorted(unique.values(), key=lambda item: (item['market'], item['symbol']))
    # Never overwrite a usable snapshot with a partial or malformed download.
    pairs = {(item['market'], item['symbol']) for item in items}
    assert len(items) > 10000 and ('KOSPI', '005930') in pairs and ('NASDAQ', 'AAPL') in pairs
    if len({item['symbol'] for item in items}) != len(items):
        raise ValueError('Some symbols appear in multiple markets; do not merge community identities by ticker')
    snapshot = {'source': 'kis', 'asOf': datetime.now(timezone.utc).isoformat(), 'items': items}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Wrote {len(items):,} instruments to {OUT}')


if __name__ == '__main__':
    main()
