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
    logger.log('Seeding store with dummy products, subscriptions, resources, and appointments...');

    // Create dummy products
    const products = [
      {
        name: 'Premium Coffee Beans',
        description:
          'Organic, fair-trade coffee beans from Colombia. Rich flavor with notes of chocolate and caramel.',
        price: 24.99,
        type: 'physical',
        imageUrl: '/assets/products/coffee.jpg',
        stock: 50,
        active: true,
      },
      {
        name: 'E-Book: Web Development Guide',
        description:
          'Complete guide to modern web development with TypeScript, Angular, and NestJS. Over 400 pages of comprehensive content.',
        price: 39.99,
        type: 'digital',
        imageUrl: '/assets/products/ebook.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Premium Subscription',
        description:
          'Monthly access to all premium features including advanced analytics, priority support, and exclusive content.',
        price: 9.99,
        type: 'subscription',
        imageUrl: '/assets/products/subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Handcrafted Ceramic Mug',
        description:
          'Beautiful ceramic mug, handmade by local artisans. Perfect for your morning coffee or tea.',
        price: 14.99,
        type: 'physical',
        imageUrl: '/assets/products/mug.jpg',
        stock: 25,
        active: true,
      },
      {
        name: 'Online Course Access',
        description:
          'Lifetime access to our complete course library with over 100 hours of video content covering web development, DevOps, and cloud computing.',
        price: 199.99,
        type: 'digital',
        imageUrl: '/assets/products/course.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'T-Shirt - Developer Edition',
        description:
          'Comfortable cotton t-shirt with unique developer-themed design. Available in multiple sizes.',
        price: 29.99,
        type: 'physical',
        imageUrl: '/assets/products/tshirt.jpg',
        stock: 15,
        active: true,
      },
      {
        name: 'Pro Subscription',
        description:
          'Annual subscription with unlimited access to all features, priority support, and early access to new releases.',
        price: 99.99,
        type: 'subscription',
        imageUrl: '/assets/products/pro-subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Laptop Sticker Pack',
        description:
          'Set of 10 high-quality vinyl stickers with developer and tech themes. Waterproof and durable.',
        price: 12.99,
        type: 'physical',
        imageUrl: '/assets/products/stickers.jpg',
        stock: 100,
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
        description: 'Large conference room with video conferencing equipment, seats up to 12 people.',
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
        description: 'Small meeting room perfect for team discussions, seats up to 6 people.',
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
        description: 'Professional video production studio with green screen, lighting, and audio equipment.',
        location: 'Building 2, Floor 1',
        capacity: 4,
        amenities: ['green_screen', 'lighting', 'microphones', 'cameras', 'soundproofing'],
        hourlyRate: 100,
        isActive: true,
        imageUrl: '/assets/resources/studio.jpg',
      },
      {
        name: 'MacBook Pro M3',
        type: 'equipment',
        description: '16-inch MacBook Pro with M3 Max chip, 64GB RAM, ideal for video editing and development.',
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
        description: 'Complete camera kit with Sony A7S III, lenses, tripod, and accessories.',
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
        description: 'Mercedes Sprinter van for transportation and equipment hauling.',
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

    // Create availability slots for resources
    if (createdResources.length > 0) {
      logger.log('Creating availability slots for resources...');
      
      // Conference rooms available Mon-Fri 9AM-5PM
      for (const resource of createdResources.filter(r => r.type === 'room')) {
        for (let day = 1; day <= 5; day++) { // Monday to Friday
          try {
            await availabilitiesService.create({
              resourceId: resource.id,
              dayOfWeek: day,
              startTime: '09:00:00',
              endTime: '17:00:00',
              hourlyRate: resource.hourlyRate,
              serviceType: 'meeting_space',
              isActive: true,
            });
            logger.log(`Created availability for ${resource.name} on day ${day}`);
          } catch (error) {
            logger.warn(`Could not create availability: ${error.message}`);
          }
        }
      }

      // Equipment available 7 days a week
      for (const resource of createdResources.filter(r => r.type === 'equipment')) {
        for (let day = 0; day <= 6; day++) {
          try {
            await availabilitiesService.create({
              resourceId: resource.id,
              dayOfWeek: day,
              startTime: '08:00:00',
              endTime: '20:00:00',
              hourlyRate: resource.hourlyRate,
              serviceType: 'equipment_rental',
              isActive: true,
            });
            logger.log(`Created availability for ${resource.name} on day ${day}`);
          } catch (error) {
            logger.warn(`Could not create availability: ${error.message}`);
          }
        }
      }
    }

    // Create sample appointments/bookings
    if (createdResources.length > 0) {
      logger.log('Creating sample appointments...');
      
      const sampleUserId = '00000000-0000-0000-0000-000000000001'; // Dummy user ID
      
      const appointments = [
        {
          userId: sampleUserId,
          resourceId: createdResources[0]?.id, // Conference Room A
          title: 'Team Planning Meeting',
          description: 'Q1 planning session with the development team',
          startTime: new Date('2026-01-20T10:00:00Z'),
          endTime: new Date('2026-01-20T12:00:00Z'),
          isFreeConsultation: false,
          notes: 'Please prepare presentation materials',
        },
        {
          userId: sampleUserId,
          resourceId: createdResources[2]?.id, // Video Studio
          title: 'Product Demo Recording',
          description: 'Recording product demonstration video for marketing',
          startTime: new Date('2026-01-21T14:00:00Z'),
          endTime: new Date('2026-01-21T16:00:00Z'),
          isFreeConsultation: false,
          notes: 'Bring script and props',
        },
        {
          userId: sampleUserId,
          resourceId: createdResources[3]?.id, // MacBook Pro
          title: 'Video Editing Session',
          description: 'Edit marketing videos for upcoming campaign',
          startTime: new Date('2026-01-22T09:00:00Z'),
          endTime: new Date('2026-01-22T13:00:00Z'),
          isFreeConsultation: false,
        },
      ];

      for (const appointmentData of appointments) {
        try {
          if (appointmentData.resourceId) {
            await appointmentsService.create(appointmentData);
            logger.log(`Created appointment: ${appointmentData.title}`);
          }
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
