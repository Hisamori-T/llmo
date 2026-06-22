from app.shared.constants.plans import ROLES


def can(role: str, permission: str) -> bool:
    return bool(ROLES.get(role, {}).get(permission, False))


def check_permission(role: str, permission: str) -> None:
    from fastapi import HTTPException, status
    if not can(role, permission):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Permission denied')
