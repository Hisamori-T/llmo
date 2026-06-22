import hashlib
from typing import Optional


def parse_device_info(user_agent: Optional[str], ip_address: Optional[str]) -> dict:
    """Extract browser/OS from User-Agent and generate a stable browser_id."""
    browser_name = 'Unknown'
    browser_version = ''
    os_name = 'Unknown'
    os_version = ''

    if user_agent:
        ua = user_agent.lower()

        if 'edg/' in ua:
            browser_name = 'Edge'
            browser_version = _extract_version(user_agent, 'Edg/')
        elif 'chrome/' in ua and 'chromium' not in ua:
            browser_name = 'Chrome'
            browser_version = _extract_version(user_agent, 'Chrome/')
        elif 'firefox/' in ua:
            browser_name = 'Firefox'
            browser_version = _extract_version(user_agent, 'Firefox/')
        elif 'safari/' in ua and 'chrome' not in ua:
            browser_name = 'Safari'
            browser_version = _extract_version(user_agent, 'Version/')

        if 'windows nt' in ua:
            os_name = 'Windows'
            os_version = _extract_version(user_agent, 'Windows NT ')
        elif 'mac os x' in ua:
            os_name = 'macOS'
            os_version = _extract_version(user_agent, 'Mac OS X ').replace('_', '.')
        elif 'android' in ua:
            os_name = 'Android'
            os_version = _extract_version(user_agent, 'Android ')
        elif 'linux' in ua:
            os_name = 'Linux'
            os_version = ''
        elif 'iphone os' in ua or 'ipad' in ua:
            os_name = 'iOS'
            os_version = _extract_version(user_agent, 'iPhone OS ').replace('_', '.')

    raw = f'{browser_name}:{browser_version}:{os_name}:{ip_address or ""}'
    browser_id = hashlib.sha256(raw.encode()).hexdigest()[:16]

    return {
        'browser_id': browser_id,
        'browser_name': browser_name,
        'browser_version': browser_version,
        'os': os_name,
        'os_version': os_version,
    }


def _extract_version(ua: str, prefix: str) -> str:
    try:
        idx = ua.index(prefix)
        rest = ua[idx + len(prefix):]
        version = rest.split()[0].split(';')[0].rstrip(')')
        return version[:20]
    except (ValueError, IndexError):
        return ''
