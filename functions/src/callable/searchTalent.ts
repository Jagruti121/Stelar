import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';

const SearchTalentSchema = z.object({
  skills: z.array(z.string()).optional(),
  placementInterest: z.string().optional(),
  minCgpa: z.number().min(0).max(10).optional(),
});

export const searchTalent = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  let roles: string[] = (request.auth.token.roles as string[]) || [];
  if (!roles.includes('FACULTY') && !roles.includes('HOD')) {
    const staffDoc = await db.collection('staff').doc(request.auth.uid).get();
    if (staffDoc.exists) {
      roles = (staffDoc.data()?.roles as string[]) || [];
    }
  }

  const isFaculty = roles.includes('FACULTY') || roles.includes('HOD');
  if (!isFaculty) {
    throw new HttpsError('permission-denied', 'Only faculty can search talent');
  }

  let data;
  try {
    data = SearchTalentSchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  // Parse placement interest filter
  let allowedPlacement: string[] = [];
  if (data.placementInterest && data.placementInterest !== 'Any') {
    const val = data.placementInterest.toLowerCase().trim();
    if (val.includes('active') || val === 'yes') {
      allowedPlacement = ['yes', 'actively looking', 'active'];
    } else if (val.includes('open') || val.includes('offer') || val === 'maybe') {
      allowedPlacement = ['maybe', 'open to offers'];
    } else if (val.includes('not') || val === 'no') {
      allowedPlacement = ['no', 'not interested'];
    } else {
      allowedPlacement = [val];
    }
  }

  const hasSkillsFilter = data.skills && data.skills.length > 0;
  let results: any[] = [];

  if (hasSkillsFilter) {
    // 1. Search by skills from studentProfiles
    let query: FirebaseFirestore.Query = db.collection('studentProfiles');
    const keys = data.skills!.map(s => s.toLowerCase().trim()).filter(Boolean);
    if (keys.length > 0) {
      query = query.where('skillKeys', 'array-contains-any', keys.slice(0, 10));
    }

    const snapshot = await query.limit(50).get();
    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const pData = doc.data();
        const profileId = doc.id;

        // Try getting the student doc by profileId or search
        let studentData: any = null;
        const studentDoc = await db.collection('students').doc(profileId).get();
        if (studentDoc.exists) {
          studentData = studentDoc.data();
        } else {
          const rawRoll = profileId.replace('student_', '');
          const byRoll = await db.collection('students').where('rollNo', '==', rawRoll).limit(1).get();
          if (!byRoll.empty) {
            studentData = byRoll.docs[0].data();
          }
        }

        results.push({
          id: profileId,
          name: studentData?.name || studentData?.rollNo || profileId,
          deptId: studentData?.department || studentData?.deptId || 'Computer Science',
          batch: studentData?.year ? `${studentData.year} Year` : 'Student',
          rollNo: studentData?.rollNo || '',
          cgpa: studentData?.cgpa !== undefined ? studentData.cgpa : undefined,
          profile: {
            bio: pData.bio || '',
            skills: pData.skills || [],
            placementInterest: pData.placementInterest === 'yes' ? 'Actively Looking' 
              : pData.placementInterest === 'maybe' ? 'Open to Offers' 
              : pData.placementInterest === 'no' ? 'Not Interested' 
              : pData.placementInterest || 'Open to Offers',
            rawPlacement: pData.placementInterest || '',
            links: pData.links || {},
            photoUrl: pData.photoUrl || ''
          }
        });
      }
    }
  } else {
    // 2. No skills specified - search students directly
    const studentsSnap = await db.collection('students').limit(50).get();
    for (const sDoc of studentsSnap.docs) {
      const sData = sDoc.data();
      const sid = sDoc.id;

      // Check if student has profile
      const pDoc = await db.collection('studentProfiles').doc(sid).get();
      const pData = pDoc.exists ? pDoc.data() : null;

      results.push({
        id: sid,
        name: sData.name || sData.rollNo || sid,
        deptId: sData.department || sData.deptId || 'Computer Science',
        batch: sData.year ? `${sData.year} Year` : 'Student',
        rollNo: sData.rollNo || '',
        cgpa: sData.cgpa !== undefined ? sData.cgpa : undefined,
        profile: {
          bio: pData?.bio || '',
          skills: pData?.skills || [],
          placementInterest: pData?.placementInterest === 'yes' ? 'Actively Looking'
            : pData?.placementInterest === 'maybe' ? 'Open to Offers'
            : pData?.placementInterest === 'no' ? 'Not Interested'
            : pData?.placementInterest || 'Open to Offers',
          rawPlacement: pData?.placementInterest || 'maybe',
          links: pData?.links || {},
          photoUrl: pData?.photoUrl || ''
        }
      });
    }
  }

  // Filter by placement interest if requested
  if (allowedPlacement.length > 0) {
    results = results.filter(r => {
      const raw = (r.profile.rawPlacement || '').toLowerCase();
      const formatted = (r.profile.placementInterest || '').toLowerCase();
      return allowedPlacement.some(ap => raw === ap || formatted === ap || formatted.includes(ap));
    });
  }

  // Filter by min CGPA if requested
  if (data.minCgpa !== undefined) {
    const min = data.minCgpa;
    results = results.filter(r => (r.cgpa !== undefined && r.cgpa >= min));
  }

  return { results };
});
