import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

export const workordersRouter = Router();

// GET /api/workorders
workordersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { districtId, status } = req.query;
    
    const where: any = { type: 'WORK_ORDER' };
    if (districtId) where.districtId = String(districtId);
    if (status) where.status = String(status);

    const orders = await prisma.urbanRecommendation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    
    res.json(orders);
  } catch (err) {
    console.error('Fetch Work Orders Error:', err);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// POST /api/workorders/generate
// Automatically generates work orders for CRITICAL UNASSIGNED events
workordersRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { districtId } = req.body;
    
    const criticalEvents = await prisma.roadEvent.findMany({
      where: {
        districtId: districtId ? String(districtId) : undefined,
        severity: 'CRITICAL',
        status: 'NEW',
        estimatedRepairCost: { not: null }
      },
    });

    if (criticalEvents.length === 0) {
      return res.json({ success: true, message: 'No critical unassigned events found', generatedCount: 0 });
    }

    let generatedCount = 0;

    for (const event of criticalEvents) {
      // Check if a work order already exists for this event
      const existing = await prisma.urbanRecommendation.findFirst({
        where: { linkedEntityId: event.id, type: 'WORK_ORDER' }
      });
      
      if (!existing) {
        await prisma.urbanRecommendation.create({
          data: {
            type: 'WORK_ORDER',
            title: `Emergency Repair: ${event.type.replace(/_/g, ' ')}`,
            description: `Urgent repair required for ${event.type} at Lat: ${event.latitude}, Lon: ${event.longitude}. Estimated repair area is ${event.areaM2} sqm.`,
            urgency: 'CRITICAL',
            impactScore: event.severityScore || 90,
            estimatedCostINR: event.estimatedRepairCost,
            districtId: event.districtId,
            status: 'PROPOSED',
            linkedEntityId: event.id,
          }
        });
        
        await prisma.roadEvent.update({
          where: { id: event.id },
          data: { status: 'ASSIGNED_FOR_REPAIR' }
        });
        
        generatedCount++;
      }
    }
    
    res.json({ success: true, message: `Generated ${generatedCount} work orders.`, generatedCount });
  } catch (err) {
    console.error('Generate Work Orders Error:', err);
    res.status(500).json({ error: 'Failed to generate work orders' });
  }
});

// PATCH /api/workorders/:id/dispatch
workordersRouter.patch('/:id/dispatch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const order = await prisma.urbanRecommendation.update({
      where: { id },
      data: { status: 'DISPATCHED' }
    });
    
    res.json({ success: true, order });
  } catch (err) {
    console.error('Dispatch Work Order Error:', err);
    res.status(500).json({ error: 'Failed to dispatch work order' });
  }
});
