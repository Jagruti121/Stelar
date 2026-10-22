/**
 * STELLAR — Firestore Data Types
 *
 * Full TypeScript type definitions for every Firestore collection.
 * All types are strict (no `any`). Used with typed converters in lib/firestore.ts.
 */

import type { Timestamp } from 'firebase/firestore';

// ── Shared primitives ──────────────────────────────────────────────────────────

export type UserRole = 'FACULTY' | 'HOD' | 'STUDENT';

export type PlacementInterest = 'yes' | 'no' | 'maybe';

export type StudentStatus = 'active' | 'inactive' | 'passedOut';

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type PrivacyLevel = 'faculty' | 'everyone';

export type AchievementCategory =
  | 'academic'
  | 'sports'
  | 'cultural'
  | 'technical'
  | 'social'
  | 'other';

export type NotificationTargetType = 'all' | 'dept' | 'division' | 'students';

export type EndorsementTargetType = 'skill' | 'achievement';

export type MessageType = 'text' | 'file' | 'image';

// ── departments/{deptId} ────────────────────────────────────────────────────────

export interface Department {
  id: string;           // Firestore doc ID
  name: string;
  code: string;         // e.g. "CSE", "MECH" — used in student ID / email
  durationYears: number; // default 3
  semesterCount: number; // default 6
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── staff/{uid} ─────────────────────────────────────────────────────────────────

export interface Staff {
  id: string;           // Firebase Auth UID
  name: string;
  email: string;
  employeeId: string;
  deptId: string;
  roles: UserRole[];    // mirrors custom claims
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── students/{studentId} ───────────────────────────────────────────────────────
// studentId = {deptCode}_{batch}_{division}_{roll}  (lowercase, deterministic)

export interface Student {
  id: string;
  name: string;
  nameLower: string;    // name.toLowerCase().trim() — for case-insensitive search
  roll: string;
  division: string;
  deptId: string;
  batch: string;        // e.g. "2023-2026"
  semester: number;     // 1–6
  status: StudentStatus;
  passwordSet: boolean;
  authUid: string | null; // null until first activation
  email: string;        // synthetic internal email (never shown to student)
  phone?: string;
  profileCompleteness: number; // 0–100
  cgpa: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── activationCodes/{studentId} ────────────────────────────────────────────────
// SERVER-ONLY — allow read, write: if false for clients

export interface ActivationCode {
  studentId: string;
  codeHash: string;     // SHA-256 of the plain 8-char activation code
  expiresAt: Timestamp;
  used: boolean;
  createdAt: Timestamp;
}

// ── studentProfiles/{studentId} ───────────────────────────────────────────────

export interface Skill {
  name: string;
  level: SkillLevel;
}

export interface ProfileLinks {
  github?: string;
  linkedin?: string;
  portfolio?: string;
}

export interface ProfilePrivacy {
  skills: PrivacyLevel;
  achievements: PrivacyLevel;
  links: PrivacyLevel;
  bio: PrivacyLevel;
}

export interface StudentProfile {
  id: string;           // same as studentId
  photoUrl?: string;
  bio: string;          // max 300 chars
  skills: Skill[];
  skillKeys: string[];  // lowercased skill names for array-contains queries
  talentKeys: string[]; // lowercased talent strings
  interestKeys: string[]; // lowercased interest strings
  expertise: string[];
  placementInterest: PlacementInterest;
  links: ProfileLinks;
  privacy: ProfilePrivacy;
  updatedAt: Timestamp;
}

// ── studentProfiles/{studentId}/achievements/{achId} ──────────────────────────

export interface Achievement {
  id: string;
  title: string;
  description: string;
  date: Timestamp;
  category: AchievementCategory;
  certificateUrl?: string;
  verified: boolean;
  verifiedBy?: string;  // facultyId
  createdAt: Timestamp;
}

// ── endorsements/{id} ─────────────────────────────────────────────────────────

export interface Endorsement {
  id: string;
  studentId: string;
  targetType: EndorsementTargetType;
  targetRef: string;    // skill name OR achievement ID
  facultyId: string;
  createdAt: Timestamp;
}

// ── skillsMaster/{skillKey} ────────────────────────────────────────────────────

export interface SkillMaster {
  id: string;           // lowercased key
  name: string;         // display name (original casing)
  category: string;
  usageCount: number;
}

// ── subjects/{id} ─────────────────────────────────────────────────────────────

export interface Subject {
  id: string;
  deptId: string;
  semester: number;
  name: string;
  code: string;
  facultyIds: string[];
  createdAt: Timestamp;
}

// ── attendanceSessions/{subjectId_division_date_slot} ─────────────────────────
// Deterministic ID: `{subjectId}_{division}_{YYYY-MM-DD}_{slot}` prevents duplicates

export interface AttendanceSession {
  id: string;
  subjectId: string;
  deptId: string;
  semester: number;
  division: string;
  date: string;         // ISO date string "YYYY-MM-DD"
  slot: string;         // e.g. "1", "2", "3"
  facultyId: string;
  presentIds: string[]; // student IDs
  absentIds: string[];  // student IDs
  totalCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── attendanceSummary/{studentId} ─────────────────────────────────────────────

export interface SubjectAttendance {
  present: number;
  total: number;
}

export interface AttendanceSummary {
  id: string;           // studentId
  bySubject: Record<string, SubjectAttendance>; // subjectId → counts
  updatedAt: Timestamp;
}

// ── results/{studentId_semester} ──────────────────────────────────────────────

export interface SubjectMark {
  subjectId: string;
  subjectCode: string;
  marks: number;
  maxMarks: number;
  grade: string;
}

export interface Result {
  id: string;           // {studentId}_{semester}
  studentId: string;
  semester: number;
  sgpa: number;
  subjectMarks: SubjectMark[];
  uploadedBy: string;   // HOD uid
  uploadedAt: Timestamp;
}

// ── notifications/{id} ────────────────────────────────────────────────────────

export interface NotificationTarget {
  type: NotificationTargetType;
  deptIds?: string[];
  divisions?: string[];
  studentIds?: string[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  attachmentUrl?: string;
  target: NotificationTarget;
  createdBy: string;    // staff uid
  createdAt: Timestamp;
}

// ── students/{id}/inbox/{notificationId} ──────────────────────────────────────

export interface InboxItem {
  id: string;           // same as notificationId
  notificationId: string;
  title: string;
  message: string;
  attachmentUrl?: string;
  read: boolean;
  createdAt: Timestamp;
}

// ── polls/{id} ────────────────────────────────────────────────────────────────

export interface PollOption {
  id: string;
  text: string;
  count: number;
}

export interface PollTarget {
  deptIds: string[];
  divisions: string[];
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  target: PollTarget;
  expiresAt?: Timestamp;
  anonymous: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

// ── polls/{id}/votes/{studentId} ──────────────────────────────────────────────

export interface PollVote {
  id: string;           // studentId (doc ID = studentId)
  studentId: string;
  optionId: string;
  authUid?: string;
  createdAt: Timestamp;
}

// ── communities/{id} ──────────────────────────────────────────────────────────

export interface CommunityRestriction {
  type: 'open' | 'dept' | 'invite';
  deptIds?: string[];
}

export interface Community {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  restriction: CommunityRestriction;
  ownerId: string;
  inviteCode: string;
  inviteEnabled: boolean;
  memberCount: number;
  createdAt: Timestamp;
}

// ── communities/{id}/members/{uid} ────────────────────────────────────────────

export interface CommunityMember {
  id: string;           // uid (doc ID)
  uid: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: Timestamp;
}

// ── communities/{id}/messages/{msgId}  &  chats/{chatId}/messages/{msgId} ─────

export interface Message {
  id: string;
  text?: string;
  fileUrl?: string;
  fileType?: string;
  fileName?: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
  readBy: string[];
  deleted: boolean;
}

// ── chats/{chatId} ────────────────────────────────────────────────────────────
// chatId = sorted UIDs joined by "_": `${uid1}_${uid2}` where uid1 < uid2

export interface Chat {
  id: string;
  participantIds: string[];   // exactly 2 UIDs
  participantNames: Record<string, string>; // uid → name
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  createdAt: Timestamp;
}

// ── communityInvites/{inviteCode} ─────────────────────────────────────────────

export interface CommunityInvite {
  id: string;           // inviteCode (doc ID)
  inviteCode: string;
  communityId: string;
  enabled: boolean;
  createdAt: Timestamp;
}

// ── resources/{id} ────────────────────────────────────────────────────────────

export interface ResourceTarget {
  deptIds: string[];
  divisions: string[];
}

export interface Resource {
  id: string;
  title: string;
  subject: string;
  description: string;
  fileUrl?: string;
  link?: string;
  target: ResourceTarget;
  uploadedBy: string;
  downloadCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── shortlists/{id} ───────────────────────────────────────────────────────────

export interface Shortlist {
  id: string;
  name: string;
  ownerId: string;
  studentIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── opportunities/{id} ────────────────────────────────────────────────────────

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  requiredSkills: string[]; // lowercased skill keys
  deadline?: Timestamp;
  deptScope: string[];      // deptIds, empty = all
  postedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ── opportunities/{id}/interests/{studentId} ──────────────────────────────────

export interface OpportunityInterest {
  id: string;           // studentId (doc ID)
  studentId: string;
  message?: string;
  createdAt: Timestamp;
}

// ── auditLogs/{id} — SERVER-WRITE ONLY ───────────────────────────────────────

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;         // e.g. "BULK_UPLOAD_STUDENTS", "RESET_PASSWORD"
  entity: string;         // collection name
  meta: Record<string, unknown>;
  createdAt: Timestamp;
}

// ── rateLimits/{id} — SERVER-WRITE ONLY ──────────────────────────────────────

export interface RateLimit {
  id: string;             // `ip_${ip}` or `email_${email}`
  attempts: number;
  windowStart: Timestamp;
  lockedUntil?: Timestamp;
}

// ── stats/{scopeId} ───────────────────────────────────────────────────────────

export interface DeptStats {
  id: string;             // scopeId (doc ID)
  scopeId: string;        // deptId or "global"
  totalStudents: number;
  activeStudents: number;
  passedOutStudents: number;
  profilesCompleted: number;
  placementInterested: number;
  defaulterCount: number;
  topSkills: Array<{ skill: string; count: number }>;
  avgAttendance: number;
  updatedAt: Timestamp;
}

// ── Auth custom claims shape ───────────────────────────────────────────────────

export interface StellarClaims {
  roles: UserRole[];
  studentId?: string;   // set for STUDENT role
  deptId?: string;
  division?: string;
}
