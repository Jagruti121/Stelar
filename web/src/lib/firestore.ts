/**
 * STELLAR — Typed Firestore Collection References
 *
 * All Firestore collection and document refs live here.
 * Uses typed converters so every read returns a properly typed object.
 * Never use db.collection() or any legacy pattern outside this file.
 */

import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type {
  Department,
  Staff,
  Student,
  StudentProfile,
  Achievement,
  Endorsement,
  SkillMaster,
  Subject,
  AttendanceSession,
  AttendanceSummary,
  Result,
  Notification,
  InboxItem,
  Poll,
  PollVote,
  Community,
  CommunityMember,
  Message,
  Chat,
  CommunityInvite,
  Resource,
  Shortlist,
  Opportunity,
  OpportunityInterest,
  AuditLog,
  DeptStats,
} from '@/types/firestore';

// ── Generic converter factory ─────────────────────────────────────────────────

/**
 * Creates a typed Firestore converter that injects the document ID
 * into the returned object as `id`.
 */
function makeConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(data: T) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...rest } = data;
      return rest;
    },
    fromFirestore(snap: QueryDocumentSnapshot): T {
      return { id: snap.id, ...snap.data() } as T;
    },
  };
}

// ── Converters ────────────────────────────────────────────────────────────────

const deptConverter = makeConverter<Department>();
const staffConverter = makeConverter<Staff>();
const studentConverter = makeConverter<Student>();
const profileConverter = makeConverter<StudentProfile>();
const achievementConverter = makeConverter<Achievement>();
const endorsementConverter = makeConverter<Endorsement>();
const skillMasterConverter = makeConverter<SkillMaster>();
const subjectConverter = makeConverter<Subject>();
const attendanceSessionConverter = makeConverter<AttendanceSession>();
const attendanceSummaryConverter = makeConverter<AttendanceSummary>();
const resultConverter = makeConverter<Result>();
const notificationConverter = makeConverter<Notification>();
const inboxConverter = makeConverter<InboxItem>();
const pollConverter = makeConverter<Poll>();
const pollVoteConverter = makeConverter<PollVote>();
const communityConverter = makeConverter<Community>();
const communityMemberConverter = makeConverter<CommunityMember>();
const messageConverter = makeConverter<Message>();
const chatConverter = makeConverter<Chat>();
const communityInviteConverter = makeConverter<CommunityInvite>();
const resourceConverter = makeConverter<Resource>();
const shortlistConverter = makeConverter<Shortlist>();
const opportunityConverter = makeConverter<Opportunity>();
const opportunityInterestConverter = makeConverter<OpportunityInterest>();
const auditLogConverter = makeConverter<AuditLog>();
const deptStatsConverter = makeConverter<DeptStats>();

// ── Collection refs ───────────────────────────────────────────────────────────

export const departmentsCol = (): CollectionReference<Department> =>
  collection(db, 'departments').withConverter(deptConverter);

export const staffCol = (): CollectionReference<Staff> =>
  collection(db, 'staff').withConverter(staffConverter);

export const studentsCol = (): CollectionReference<Student> =>
  collection(db, 'students').withConverter(studentConverter);

export const studentProfilesCol = (): CollectionReference<StudentProfile> =>
  collection(db, 'studentProfiles').withConverter(profileConverter);

export const endorsementsCol = (): CollectionReference<Endorsement> =>
  collection(db, 'endorsements').withConverter(endorsementConverter);

export const skillsMasterCol = (): CollectionReference<SkillMaster> =>
  collection(db, 'skillsMaster').withConverter(skillMasterConverter);

export const subjectsCol = (): CollectionReference<Subject> =>
  collection(db, 'subjects').withConverter(subjectConverter);

export const attendanceSessionsCol = (): CollectionReference<AttendanceSession> =>
  collection(db, 'attendanceSessions').withConverter(attendanceSessionConverter);

export const notificationsCol = (): CollectionReference<Notification> =>
  collection(db, 'notifications').withConverter(notificationConverter);

export const pollsCol = (): CollectionReference<Poll> =>
  collection(db, 'polls').withConverter(pollConverter);

export const communitiesCol = (): CollectionReference<Community> =>
  collection(db, 'communities').withConverter(communityConverter);

export const communityInvitesCol = (): CollectionReference<CommunityInvite> =>
  collection(db, 'communityInvites').withConverter(communityInviteConverter);

export const chatsCol = (): CollectionReference<Chat> =>
  collection(db, 'chats').withConverter(chatConverter);

export const resourcesCol = (): CollectionReference<Resource> =>
  collection(db, 'resources').withConverter(resourceConverter);

export const shortlistsCol = (): CollectionReference<Shortlist> =>
  collection(db, 'shortlists').withConverter(shortlistConverter);

export const opportunitiesCol = (): CollectionReference<Opportunity> =>
  collection(db, 'opportunities').withConverter(opportunityConverter);

export const statsCol = (): CollectionReference<DeptStats> =>
  collection(db, 'stats').withConverter(deptStatsConverter);

// ── Document refs ─────────────────────────────────────────────────────────────

export const deptDoc = (deptId: string): DocumentReference<Department> =>
  doc(db, 'departments', deptId).withConverter(deptConverter);

export const staffDoc = (uid: string): DocumentReference<Staff> =>
  doc(db, 'staff', uid).withConverter(staffConverter);

export const studentDoc = (studentId: string): DocumentReference<Student> =>
  doc(db, 'students', studentId).withConverter(studentConverter);

export const studentProfileDoc = (studentId: string): DocumentReference<StudentProfile> =>
  doc(db, 'studentProfiles', studentId).withConverter(profileConverter);

// ── Sub-collection refs ───────────────────────────────────────────────────────

export const achievementsCol = (studentId: string): CollectionReference<Achievement> =>
  collection(db, 'studentProfiles', studentId, 'achievements').withConverter(
    achievementConverter
  );

export const inboxCol = (studentId: string): CollectionReference<InboxItem> =>
  collection(db, 'students', studentId, 'inbox').withConverter(inboxConverter);

export const pollVotesCol = (pollId: string): CollectionReference<PollVote> =>
  collection(db, 'polls', pollId, 'votes').withConverter(pollVoteConverter);

export const communityMembersCol = (communityId: string): CollectionReference<CommunityMember> =>
  collection(db, 'communities', communityId, 'members').withConverter(
    communityMemberConverter
  );

export const communityMessagesCol = (communityId: string): CollectionReference<Message> =>
  collection(db, 'communities', communityId, 'messages').withConverter(
    messageConverter
  );

export const chatMessagesCol = (chatId: string): CollectionReference<Message> =>
  collection(db, 'chats', chatId, 'messages').withConverter(messageConverter);

export const attendanceSummaryDoc = (studentId: string): DocumentReference<AttendanceSummary> =>
  doc(db, 'attendanceSummary', studentId).withConverter(attendanceSummaryConverter);

export const resultDoc = (studentId: string, semester: number): DocumentReference<Result> =>
  doc(db, 'results', `${studentId}_${semester}`).withConverter(resultConverter);

export const opportunityInterestsCol = (
  opportunityId: string
): CollectionReference<OpportunityInterest> =>
  collection(db, 'opportunities', opportunityId, 'interests').withConverter(
    opportunityInterestConverter
  );

export const auditLogsCol = (): CollectionReference<AuditLog> =>
  collection(db, 'auditLogs').withConverter(auditLogConverter);
