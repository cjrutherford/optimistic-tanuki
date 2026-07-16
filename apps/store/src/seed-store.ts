import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ProductsService } from './products/products.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { ResourcesService } from './appointments/resources.service';
import { AvailabilitiesService } from './appointments/availabilities.service';
import { AppointmentsService } from './appointments/appointments.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('StoreSeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const productsService = app.get(ProductsService);
    const subscriptionsService = app.get(SubscriptionsService);
    const resourcesService = app.get(ResourcesService);
    const availabilitiesService = app.get(AvailabilitiesService);
    const appointmentsService = app.get(AppointmentsService);

    // Clear existing data (optional)
    logger.log(
      'Seeding store with dummy products, subscriptions, resources, and appointments...'
    );

    // Create dummy products
    const products = [
      {
        name: 'Premium Coffee Beans',
        description:
          'Organic, fair-trade coffee beans from Colombia. Rich flavor with notes of chocolate and caramel.',
        priceCents: 2499,
        type: 'physical',
        imageUrl: '/assets/products/coffee.jpg',
        stock: 50,
        active: true,
      },
      {
        name: 'E-Book: Web Development Guide',
        description:
          'Complete guide to modern web development with TypeScript, Angular, and NestJS. Over 400 pages of comprehensive content.',
        priceCents: 3999,
        type: 'digital',
        imageUrl: '/assets/products/ebook.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Premium Subscription',
        description:
          'Monthly access to all premium features including advanced analytics, priority support, and exclusive content.',
        priceCents: 999,
        type: 'subscription',
        imageUrl: '/assets/products/subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Handcrafted Ceramic Mug',
        description:
          'Beautiful ceramic mug, handmade by local artisans. Perfect for your morning coffee or tea.',
        priceCents: 1499,
        type: 'physical',
        imageUrl: '/assets/products/mug.jpg',
        stock: 25,
        active: true,
      },
      {
        name: 'Online Course Access',
        description:
          'Lifetime access to our complete course library with over 100 hours of video content covering web development, DevOps, and cloud computing.',
        priceCents: 19999,
        type: 'digital',
        imageUrl: '/assets/products/course.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'T-Shirt - Developer Edition',
        description:
          'Comfortable cotton t-shirt with unique developer-themed design. Available in multiple sizes.',
        priceCents: 2999,
        type: 'physical',
        imageUrl: '/assets/products/tshirt.jpg',
        stock: 15,
        active: true,
      },
      {
        name: 'Pro Subscription',
        description:
          'Annual subscription with unlimited access to all features, priority support, and early access to new releases.',
        priceCents: 9999,
        type: 'subscription',
        imageUrl: '/assets/products/pro-subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Laptop Sticker Pack',
        description:
          'Set of 10 high-quality vinyl stickers with developer and tech themes. Waterproof and durable.',
        priceCents: 1299,
        type: 'physical',
        imageUrl: '/assets/products/stickers.jpg',
        stock: 100,
        active: true,
      },
      {
        name: 'Emberline Studio Mini Print Set',
        description:
          'Set of three archival mini prints featuring Emberline Studio landscape and portrait studies, packaged for ready-to-ship collector orders.',
        priceCents: 3600,
        type: 'physical',
        imageUrl: '/assets/products/emberline-mini-print-set.jpg',
        stock: 18,
        active: true,
      },
      {
        name: 'Emberline Studio Sticker Sheet',
        description:
          'Illustrated vinyl sticker sheet with studio mascots, brush motifs, and signature Emberline color accents.',
        priceCents: 800,
        type: 'physical',
        imageUrl: '/assets/products/emberline-sticker-sheet.jpg',
        stock: 42,
        active: true,
      },
      {
        name: 'Original Gouache Landscape',
        description:
          'One-of-a-kind gouache painting from the current Emberline Studio release, sealed and ready to ship with collector notes.',
        priceCents: 24000,
        type: 'physical',
        imageUrl: '/assets/products/emberline-gouache-landscape.jpg',
        stock: 4,
        active: true,
      },
      {
        name: 'Emberline Commission Planning Session',
        description:
          'A paid planning consult for collector goals, portrait references, medium selection, and turnaround before a commission slot is reserved.',
        priceCents: 4500,
        type: 'service',
        stock: 999,
        active: true,
      },
      {
        name: 'Emberline Custom Pet Portrait Commission',
        description:
          'Store-backed commission slot for a custom pet portrait with concept review and delivery timeline.',
        priceCents: 32000,
        type: 'service',
        stock: 24,
        active: true,
      },
    ];

    for (const productData of products) {
      try {
        await productsService.create(productData);
        logger.log(`Created product: ${productData.name}`);
      } catch (error) {
        logger.warn(
          `Product "${productData.name}" may already exist or error occurred: ${error.message}`
        );
      }
    }

    // Create dummy resources
    const resources = [
      {
        name: 'Conference Room A',
        type: 'room',
        description:
          'Large conference room with video conferencing equipment, seats up to 12 people.',
        location: 'Building 1, Floor 3',
        capacity: 12,
        amenities: ['projector', 'whiteboard', 'video_conference', 'wifi'],
        hourlyRate: 50,
        isActive: true,
        imageUrl: '/assets/resources/conference-room-a.jpg',
      },
      {
        name: 'Conference Room B',
        type: 'room',
        description:
          'Small meeting room perfect for team discussions, seats up to 6 people.',
        location: 'Building 1, Floor 2',
        capacity: 6,
        amenities: ['whiteboard', 'tv_screen', 'wifi'],
        hourlyRate: 30,
        isActive: true,
        imageUrl: '/assets/resources/conference-room-b.jpg',
      },
      {
        name: 'Video Production Studio',
        type: 'room',
        description:
          'Professional video production studio with green screen, lighting, and audio equipment.',
        location: 'Building 2, Floor 1',
        capacity: 4,
        amenities: [
          'green_screen',
          'lighting',
          'microphones',
          'cameras',
          'soundproofing',
        ],
        hourlyRate: 100,
        isActive: true,
        imageUrl: '/assets/resources/studio.jpg',
      },
      {
        name: 'MacBook Pro M3',
        type: 'equipment',
        description:
          '16-inch MacBook Pro with M3 Max chip, 64GB RAM, ideal for video editing and development.',
        location: 'Equipment Room',
        capacity: 1,
        amenities: ['high_performance', 'portable'],
        hourlyRate: 25,
        isActive: true,
        imageUrl: '/assets/resources/macbook.jpg',
      },
      {
        name: 'Professional Camera Kit',
        type: 'equipment',
        description:
          'Complete camera kit with Sony A7S III, lenses, tripod, and accessories.',
        location: 'Equipment Room',
        capacity: 1,
        amenities: ['4k_video', 'multiple_lenses', 'stabilization'],
        hourlyRate: 40,
        isActive: true,
        imageUrl: '/assets/resources/camera-kit.jpg',
      },
      {
        name: 'Company Van',
        type: 'vehicle',
        description:
          'Mercedes Sprinter van for transportation and equipment hauling.',
        location: 'Parking Garage Level 2',
        capacity: 8,
        amenities: ['gps', 'bluetooth', 'cargo_space'],
        hourlyRate: 35,
        isActive: true,
        imageUrl: '/assets/resources/van.jpg',
      },
    ];

    const createdResources: any[] = [];
    for (const resourceData of resources) {
      try {
        const resource = await resourcesService.create(resourceData);
        createdResources.push(resource);
        logger.log(`Created resource: ${resourceData.name}`);
      } catch (error) {
        logger.warn(
          `Resource "${resourceData.name}" may already exist or error occurred: ${error.message}`
        );
      }
    }

    // Create the availability schedule.
    // The booking service scopes availability-overlap by (ownerId, dayOfWeek) —
    // NOT by resource (see AvailabilitiesService.assertAvailabilityDoesNotOverlap)
    // — so seeding one window per resource all under the shared null owner
    // self-overlaps. Seed a single shared window per day for the demo schedule
    // instead. Appointment validation also keys on (ownerId, dayOfWeek, time),
    // not resource, so this is what actually gates bookings.
    if (createdResources.length > 0) {
      logger.log('Creating availability schedule...');

      // Idempotent re-seed: only add days that don't already have a null-owner
      // window, so re-runs don't emit "overlap" warnings.
      const existingAvailabilities = await availabilitiesService.findAll();
      const seededDays = new Set(
        existingAvailabilities
          .filter((a) => a.ownerId == null)
          .map((a) => a.dayOfWeek)
      );
      const demoHourlyRate = createdResources[0]?.hourlyRate ?? 0;

      // Open 8AM–8PM (business time zone) every day, covering both the room and
      // equipment demo booking windows.
      for (let day = 0; day <= 6; day++) {
        if (seededDays.has(day)) {
          continue;
        }
        try {
          await availabilitiesService.create({
            dayOfWeek: day,
            startTime: '08:00:00',
            endTime: '20:00:00',
            hourlyRate: demoHourlyRate,
            serviceType: 'general',
            isActive: true,
          });
          seededDays.add(day);
          logger.log(`Created availability for day ${day}`);
        } catch (error) {
          logger.warn(`Could not create availability: ${error.message}`);
        }
      }
    }

    // Create sample appointments/bookings
    if (createdResources.length > 0) {
      logger.log('Creating sample appointments...');

      const sampleUserId = '00000000-0000-0000-0000-000000000001'; // Dummy user ID

      // Times are UTC but must fall within the published availability window,
      // which is evaluated in the business time zone (default America/New_York,
      // UTC-5 in January). 15:00Z–20:00Z maps to 10:00–15:00 ET, inside both the
      // room (09:00–17:00) and equipment (08:00–20:00) windows.
      const appointments = [
        {
          userId: sampleUserId,
          resourceId: createdResources[0]?.id, // Conference Room A
          title: 'Team Planning Meeting',
          description: 'Q1 planning session with the development team',
          startTime: new Date('2026-01-20T15:00:00Z'),
          endTime: new Date('2026-01-20T17:00:00Z'),
          isFreeConsultation: false,
          notes: 'Please prepare presentation materials',
        },
        {
          userId: sampleUserId,
          resourceId: createdResources[2]?.id, // Video Studio
          title: 'Product Demo Recording',
          description: 'Recording product demonstration video for marketing',
          startTime: new Date('2026-01-21T18:00:00Z'),
          endTime: new Date('2026-01-21T20:00:00Z'),
          isFreeConsultation: false,
          notes: 'Bring script and props',
        },
        {
          userId: sampleUserId,
          resourceId: createdResources[3]?.id, // MacBook Pro
          title: 'Video Editing Session',
          description: 'Edit marketing videos for upcoming campaign',
          startTime: new Date('2026-01-22T15:00:00Z'),
          endTime: new Date('2026-01-22T19:00:00Z'),
          isFreeConsultation: false,
        },
      ];

      // Idempotent re-seed: the booking service rejects appointments that
      // conflict by (ownerId, time window) regardless of resource, and the seed
      // recreates resources on every run — so key the skip on the start time of
      // existing null-owner appointments, not on resourceId (which changes).
      const existingAppointments = await appointmentsService.findAll();
      const bookedTimes = new Set(
        existingAppointments
          .filter((a) => a.ownerId == null)
          .map((a) => new Date(a.startTime).getTime())
      );

      for (const appointmentData of appointments) {
        if (!appointmentData.resourceId) {
          continue;
        }
        const startMs = appointmentData.startTime.getTime();
        if (bookedTimes.has(startMs)) {
          continue;
        }
        try {
          await appointmentsService.create(appointmentData);
          bookedTimes.add(startMs);
          logger.log(`Created appointment: ${appointmentData.title}`);
        } catch (error) {
          logger.warn(`Could not create appointment: ${error.message}`);
        }
      }
    }

    logger.log('Store seeding completed successfully!');
    logger.log(`Created ${products.length} products`);
    logger.log(`Created ${createdResources.length} resources`);
  } catch (error) {
    logger.error('Error seeding store:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
