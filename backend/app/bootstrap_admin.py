import sys
from app.database.connection import SessionLocal
from app.models.role import Role
from app.models.user import User
from app.core.config import settings
from app.core.security import get_password_hash


def bootstrap_roles_and_admin():
    """
    Bootstrap the database with standard roles (ADMIN, SUPERVISOR, WORKER)
    and create the initial superuser if not already present.
    """
    db = SessionLocal()
    try:
        print("[*] Checking system roles...")
        roles_data = [
            ("ADMIN", "Full system-level access and administrative capabilities"),
            ("SUPERVISOR", "Team management, worker tracking, and submission review"),
            ("WORKER", "Field survey taker with location tracking and task management"),
        ]

        roles_map = {}
        for role_name, description in roles_data:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                role = Role(name=role_name, description=description)
                db.add(role)
                db.commit()
                db.refresh(role)
                print(f"[+] Created role: {role_name}")
            else:
                print(f"[-] Role already exists: {role_name}")
            roles_map[role_name] = role

        admin_email = settings.FIRST_SUPERUSER_EMAIL.lower().strip()
        print(f"[*] Checking initial admin user ({admin_email})...")
        admin_user = db.query(User).filter(User.email == admin_email).first()

        if not admin_user:
            admin_role = roles_map["ADMIN"]
            admin_user = User(
                email=admin_email,
                hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
                full_name="System Administrator",
                phone_number=None,
                role_id=admin_role.id,
                is_active=True,
            )
            db.add(admin_user)
            db.commit()
            print(f"[SUCCESS] Initial admin user created: {admin_email}")
        else:
            print(f"[-] Admin user already exists: {admin_email}")

    except Exception as e:
        print(f"[ERROR] Bootstrap failed: {e}", file=sys.stderr)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    bootstrap_roles_and_admin()
