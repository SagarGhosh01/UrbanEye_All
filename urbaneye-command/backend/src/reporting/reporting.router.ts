import { Router } from 'express';
import { prisma } from '../prisma.js';

export const reportingRouter = Router();

// GET /api/reporting/csv
// Generates a real CSV report of road defects for government use
reportingRouter.get('/csv', async (req, res) => {
  try {
    const { districtId, status, from, to } = req.query;

    const whereClause: any = {};
    if (districtId && districtId !== 'ALL') {
      whereClause.districtId = districtId as string;
    }
    if (status && status !== 'ALL') {
      whereClause.status = status as string;
    }
    if (from || to) {
      whereClause.timestamp = {};
      if (from) whereClause.timestamp.gte = new Date(from as string);
      if (to) whereClause.timestamp.lte = new Date(to as string);
    }

    const events = await prisma.roadEvent.findMany({
      where: whereClause,
      include: {
        district: { select: { name: true, code: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: 5000 // Limit for safety
    });

    const headers = [
      'Issue_ID',
      'Defect_Type',
      'Severity',
      'Severity_Score',
      'Location_Bus',
      'District',
      'Latitude',
      'Longitude',
      'Estimated_Repair_Cost_INR',
      'Status',
      'Reported_At',
      'Assigned_At',
      'Resolved_At'
    ];

    const rows = events.map(e => {
      return [
        `"UE-2026-${e.id.replace(/[^a-zA-Z0-9]/g, '').slice(-5).toUpperCase()}"`,
        `"${e.type}"`,
        `"${e.severity || 'HIGH'}"`,
        e.severityScore || 0,
        `"${e.busLabel}"`,
        `"${e.district?.name || 'Unknown'}"`,
        e.latitude,
        e.longitude,
        e.estimatedRepairCost || 0,
        `"${e.status}"`,
        `"${e.timestamp.toISOString()}"`,
        e.assignedAt ? `"${e.assignedAt.toISOString()}"` : '""',
        e.resolvedAt ? `"${e.resolvedAt.toISOString()}"` : '""'
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=SRIMS_Official_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csvContent);
  } catch (error) {
    console.error('Reporting export error:', error);
    res.status(500).json({ error: 'Failed to generate official report.' });
  }
});
