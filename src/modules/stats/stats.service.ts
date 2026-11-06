import { TZDate } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import type { Types } from 'mongoose';
import {
  GENDERS,
  PATIENT_CONDITIONS,
  type Gender,
  type PatientCondition,
  type Specialization,
} from '../../constants/domain.js';
import { ApiError } from '../../utils/ApiError.js';
import { Doctor } from '../doctors/doctor.model.js';
import { Patient } from '../patients/patient.model.js';
import type { Interval, OverviewQuery } from './stats.schema.js';

const MAX_BUCKETS = 400;

const AGE_GROUPS = [
  { min: 0, max: 18, label: '0–17' },
  { min: 18, max: 30, label: '18–29' },
  { min: 30, max: 45, label: '30–44' },
  { min: 45, max: 60, label: '45–59' },
  { min: 60, max: 75, label: '60–74' },
  { min: 75, max: 200, label: '75+' },
] as const;

const truncate = { day: startOfDay, week: startOfWeek, month: startOfMonth };
const step = { day: addDays, week: addWeeks, month: addMonths };

function pickInterval(from: Date, to: Date): Interval {
  const days = differenceInCalendarDays(to, from);
  if (days <= 62) return 'day';
  if (days <= 26 * 7) return 'week';
  return 'month';
}

function bucketStarts(from: Date, to: Date, interval: Interval, tz: string): Date[] {
  const starts: Date[] = [];
  for (
    let cursor = truncate[interval](new TZDate(from, tz));
    cursor <= to;
    cursor = step[interval](cursor, 1)
  ) {
    starts.push(new Date(cursor.getTime()));
    if (starts.length > MAX_BUCKETS) {
      throw ApiError.badRequest(
        `This range would produce more than ${MAX_BUCKETS} ${interval}s. Choose a larger interval or a shorter range.`,
      );
    }
  }
  return starts;
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

type RangeFacet = {
  total: { count: number }[];
  timeline: { _id: Date; count: number; critical: number }[];
  byCondition: { _id: PatientCondition; count: number }[];
  byGender: { _id: Gender; count: number }[];
  ageGroups: { _id: number | 'other'; count: number }[];
  topDoctors: {
    _id: Types.ObjectId;
    count: number;
    doctor: { name: string; specialization: Specialization };
  }[];
};

export async function getOverview(query: OverviewQuery) {
  const now = new Date();
  const { tz } = query;
  const to = query.to ?? now;
  const from = query.from ?? new Date(startOfMonth(subMonths(new TZDate(to, tz), 11)).getTime());
  const interval = query.interval ?? pickInterval(from, to);
  const buckets = bucketStarts(from, to, interval, tz);

  const periodMs = to.getTime() - from.getTime();
  const previousFrom = new Date(from.getTime() - periodMs - 1);
  const previousTo = new Date(from.getTime() - 1);

  const [totalDoctors, totalPatients, criticalPatients, previousNewPatients, [facet], specialties] =
    await Promise.all([
      Doctor.estimatedDocumentCount(),
      Patient.estimatedDocumentCount(),
      Patient.countDocuments({ condition: 'critical' }),
      Patient.countDocuments({ admissionDate: { $gte: previousFrom, $lte: previousTo } }),
      Patient.aggregate<RangeFacet>([
        { $match: { admissionDate: { $gte: from, $lte: to } } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            timeline: [
              {
                $group: {
                  _id: { $dateTrunc: { date: '$admissionDate', unit: interval, timezone: tz } },
                  count: { $sum: 1 },
                  critical: { $sum: { $cond: [{ $eq: ['$condition', 'critical'] }, 1, 0] } },
                },
              },
            ],
            byCondition: [{ $group: { _id: '$condition', count: { $sum: 1 } } }],
            byGender: [{ $group: { _id: '$gender', count: { $sum: 1 } } }],
            ageGroups: [
              {
                $bucket: {
                  groupBy: { $dateDiff: { startDate: '$dateOfBirth', endDate: now, unit: 'year' } },
                  boundaries: [...AGE_GROUPS.map((group) => group.min), 200],
                  default: 'other',
                  output: { count: { $sum: 1 } },
                },
              },
            ],
            topDoctors: [
              { $group: { _id: '$doctor', count: { $sum: 1 } } },
              { $sort: { count: -1, _id: 1 } },
              { $limit: 10 },
              {
                $lookup: {
                  from: Doctor.collection.name,
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1, specialization: 1 } }],
                  as: 'doctor',
                },
              },
              { $unwind: '$doctor' },
            ],
          },
        },
      ]),
      Doctor.aggregate<{ _id: Specialization; count: number }>([
        { $group: { _id: '$specialization', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
    ]);

  const timelineByStart = new Map(facet!.timeline.map((row) => [row._id.getTime(), row]));
  const conditionCounts = new Map(facet!.byCondition.map((row) => [row._id, row.count]));
  const genderCounts = new Map(facet!.byGender.map((row) => [row._id, row.count]));
  const ageCounts = new Map(facet!.ageGroups.map((row) => [row._id, row.count]));
  const newPatients = facet!.total[0]?.count ?? 0;

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
      interval,
      timezone: tz,
    },
    totals: {
      doctors: totalDoctors,
      patients: totalPatients,
      criticalPatients,
      avgPatientsPerDoctor: totalDoctors ? Math.round((totalPatients / totalDoctors) * 10) / 10 : 0,
    },
    period: {
      newPatients,
      previousNewPatients,
      changePct: percentChange(newPatients, previousNewPatients),
    },
    timeline: buckets.map((start) => {
      const row = timelineByStart.get(start.getTime());
      return { date: start.toISOString(), count: row?.count ?? 0, critical: row?.critical ?? 0 };
    }),
    byCondition: PATIENT_CONDITIONS.map((condition) => ({
      condition,
      count: conditionCounts.get(condition) ?? 0,
    })),
    byGender: GENDERS.map((gender) => ({ gender, count: genderCounts.get(gender) ?? 0 })),
    ageGroups: AGE_GROUPS.map((group) => ({
      label: group.label,
      count: ageCounts.get(group.min) ?? 0,
    })),
    topDoctors: facet!.topDoctors.map((row) => ({
      id: row._id.toString(),
      name: row.doctor.name,
      specialization: row.doctor.specialization,
      count: row.count,
    })),
    doctorsBySpecialization: specialties.map((row) => ({
      specialization: row._id,
      count: row.count,
    })),
  };
}
