import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

export const workordersRouter = Router();

// GET /api/workorders
workordersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { districtId, status } = req.query;
    
    const where: any = { type: 'WORK_ORDER' };
    if (districtId && districtId !== 'ALL') where.districtId = String(districtId);
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

// POST /api/workorders
// Explicitly create or update a work order
workordersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, urgency, impactScore, estimatedCostINR, districtId, status, linkedEntityId } = req.body;

    let order = null;
    if (linkedEntityId) {
      const existing = await prisma.urbanRecommendation.findFirst({
        where: { linkedEntityId: String(linkedEntityId), type: 'WORK_ORDER' }
      });
      if (existing) {
        order = await prisma.urbanRecommendation.update({
          where: { id: existing.id },
          data: {
            title: title || existing.title,
            description: description || existing.description,
            urgency: urgency || existing.urgency,
            impactScore: impactScore !== undefined ? Number(impactScore) : existing.impactScore,
            estimatedCostINR: estimatedCostINR !== undefined ? Number(estimatedCostINR) : existing.estimatedCostINR,
            districtId: districtId || existing.districtId,
            status: status || existing.status,
          }
        });
      }
    }

    if (!order) {
      order = await prisma.urbanRecommendation.create({
        data: {
          type: 'WORK_ORDER',
          title: title || 'Road Repair Work Order',
          description: description || 'Work order dispatched from command portal.',
          urgency: urgency || 'HIGH',
          impactScore: impactScore !== undefined ? Number(impactScore) : 80,
          estimatedCostINR: estimatedCostINR !== undefined ? Number(estimatedCostINR) : 5000,
          districtId: districtId || 'd1',
          status: status || 'DISPATCHED',
          linkedEntityId: linkedEntityId ? String(linkedEntityId) : null,
        }
      });
    }

    // Update associated road event status if linked
    if (linkedEntityId) {
      await prisma.roadEvent.update({
        where: { id: String(linkedEntityId) },
        data: {
          status: 'ASSIGNED_FOR_REPAIR',
          assignedAt: new Date()
        }
      }).catch((err) => console.warn('Could not update road event status:', err.message));
    }

    res.json({ success: true, order });
  } catch (err) {
    console.error('Create Work Order Error:', err);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// POST /api/workorders/generate
// Automatically generates work orders for CRITICAL UNASSIGNED events
workordersRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const { districtId } = req.body;
    
    const criticalEvents = await prisma.roadEvent.findMany({
      where: {
        districtId: districtId && districtId !== 'ALL' ? String(districtId) : undefined,
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
            description: `Urgent repair required for ${event.type} at Lat: ${event.latitude.toFixed(4)}, Lon: ${event.longitude.toFixed(4)}. Estimated repair area is ${(event.areaM2 || 1.0).toFixed(2)} sqm.`,
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
          data: {
            status: 'ASSIGNED_FOR_REPAIR',
            assignedAt: new Date()
          }
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

    if (order.linkedEntityId) {
      await prisma.roadEvent.update({
        where: { id: order.linkedEntityId },
        data: {
          status: 'ASSIGNED_FOR_REPAIR',
          assignedAt: new Date()
        }
      }).catch((err) => console.warn('Could not update linked event on dispatch:', err.message));
    }
    
    res.json({ success: true, order });
  } catch (err) {
    console.error('Dispatch Work Order Error:', err);
    res.status(500).json({ error: 'Failed to dispatch work order' });
  }
});

