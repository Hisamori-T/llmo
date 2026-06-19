from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Float, DateTime, Boolean, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID
import uuid
from .database import Base
import enum

class PlanEnum(str, enum.Enum):
    starter = 'starter'
    pro = 'pro'
    enterprise = 'enterprise'

class RoleEnum(str, enum.Enum):
    admin = 'admin'
    editor = 'editor'
    viewer = 'viewer'

class DiagnosisStatusEnum(str, enum.Enum):
    pending = 'pending'
    running = 'running'
    completed = 'completed'
    failed = 'failed'

class User(Base):
    __tablename__ = 'users'

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255))
    plan: Mapped[PlanEnum] = mapped_column(SAEnum(PlanEnum), default=PlanEnum.starter)
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.admin)
    org_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey('organizations.id'), nullable=True)
    monthly_credits_used: Mapped[int] = mapped_column(Integer, default=0)
    credits_reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sessions: Mapped[list['Session']] = relationship('Session', back_populates='user', cascade='all, delete-orphan')
    diagnoses: Mapped[list['Diagnosis']] = relationship('Diagnosis', back_populates='user')
    org: Mapped[Optional['Organization']] = relationship('Organization', back_populates='members')

class Organization(Base):
    __tablename__ = 'organizations'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255))
    plan: Mapped[PlanEnum] = mapped_column(SAEnum(PlanEnum), default=PlanEnum.starter)
    monthly_credits_limit: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list['User']] = relationship('User', back_populates='org')
    subscriptions: Mapped[list['Subscription']] = relationship('Subscription', back_populates='org')

class Subscription(Base):
    __tablename__ = 'subscriptions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id: Mapped[str] = mapped_column(String(36), ForeignKey('organizations.id'))
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255))
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255))
    plan: Mapped[PlanEnum] = mapped_column(SAEnum(PlanEnum))
    billing_cycle: Mapped[str] = mapped_column(String(20), default='monthly')
    status: Mapped[str] = mapped_column(String(50), default='active')
    current_period_start: Mapped[Optional[datetime]] = mapped_column(DateTime)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    org: Mapped['Organization'] = relationship('Organization', back_populates='subscriptions')

class Session(Base):
    __tablename__ = 'sessions'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey('users.id'))
    device_id: Mapped[str] = mapped_column(String(64))
    browser_id: Mapped[str] = mapped_column(String(64))
    browser_name: Mapped[Optional[str]] = mapped_column(String(100))
    browser_version: Mapped[Optional[str]] = mapped_column(String(50))
    os: Mapped[Optional[str]] = mapped_column(String(100))
    os_version: Mapped[Optional[str]] = mapped_column(String(50))
    ip_address: Mapped[Optional[str]] = mapped_column(String(45))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default='active')
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(50))
    last_activity: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped['User'] = relationship('User', back_populates='sessions')

class Diagnosis(Base):
    __tablename__ = 'diagnoses'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey('users.id'))
    org_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey('organizations.id'))
    company_name: Mapped[str] = mapped_column(String(255))
    industry: Mapped[str] = mapped_column(String(100))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    keywords: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    status: Mapped[DiagnosisStatusEnum] = mapped_column(SAEnum(DiagnosisStatusEnum), default=DiagnosisStatusEnum.pending)
    scores: Mapped[Optional[dict]] = mapped_column(JSONB)
    findings: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    recommendations: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    raw_llm_response: Mapped[Optional[str]] = mapped_column(Text)
    credits_consumed: Mapped[int] = mapped_column(Integer, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    user: Mapped['User'] = relationship('User', back_populates='diagnoses')
    reports: Mapped[list['Report']] = relationship('Report', back_populates='diagnosis')

class Report(Base):
    __tablename__ = 'reports'

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    diagnosis_id: Mapped[str] = mapped_column(String(36), ForeignKey('diagnoses.id'))
    user_id: Mapped[str] = mapped_column(String(128), ForeignKey('users.id'))
    type: Mapped[str] = mapped_column(String(20), default='simple')
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500))
    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True)
    share_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    diagnosis: Mapped['Diagnosis'] = relationship('Diagnosis', back_populates='reports')
