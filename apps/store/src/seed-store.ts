import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { ProductsService } from './products/products.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('StoreSeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const productsService = app.get(ProductsService);
    const subscriptionsService = app.get(SubscriptionsService);

    // Clear existing data (optional)
    logger.log('Seeding store with dummy products and subscriptions...');

    // Create dummy products
    const products = [
      {
        name: 'Premium Coffee Beans',
        description: 'Organic, fair-trade coffee beans from Colombia. Rich flavor with notes of chocolate and caramel.',
        price: 24.99,
        type: 'physical',
        imageUrl: '/assets/products/coffee.jpg',
        stock: 50,
        active: true,
      },
      {
        name: 'E-Book: Web Development Guide',
        description: 'Complete guide to modern web development with TypeScript, Angular, and NestJS. Over 400 pages of comprehensive content.',
        price: 39.99,
        type: 'digital',
        imageUrl: '/assets/products/ebook.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Premium Subscription',
        description: 'Monthly access to all premium features including advanced analytics, priority support, and exclusive content.',
        price: 9.99,
        type: 'subscription',
        imageUrl: '/assets/products/subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Handcrafted Ceramic Mug',
        description: 'Beautiful ceramic mug, handmade by local artisans. Perfect for your morning coffee or tea.',
        price: 14.99,
        type: 'physical',
        imageUrl: '/assets/products/mug.jpg',
        stock: 25,
        active: true,
      },
      {
        name: 'Online Course Access',
        description: 'Lifetime access to our complete course library with over 100 hours of video content covering web development, DevOps, and cloud computing.',
        price: 199.99,
        type: 'digital',
        imageUrl: '/assets/products/course.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'T-Shirt - Developer Edition',
        description: 'Comfortable cotton t-shirt with unique developer-themed design. Available in multiple sizes.',
        price: 29.99,
        type: 'physical',
        imageUrl: '/assets/products/tshirt.jpg',
        stock: 15,
        active: true,
      },
      {
        name: 'Pro Subscription',
        description: 'Annual subscription with unlimited access to all features, priority support, and early access to new releases.',
        price: 99.99,
        type: 'subscription',
        imageUrl: '/assets/products/pro-subscription.jpg',
        stock: 999,
        active: true,
      },
      {
        name: 'Laptop Sticker Pack',
        description: 'Set of 10 high-quality vinyl stickers with developer and tech themes. Waterproof and durable.',
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
        logger.warn(`Product "${productData.name}" may already exist or error occurred: ${error.message}`);
      }
    }

    logger.log('Store seeding completed successfully!');
    logger.log(`Created ${products.length} products`);
  } catch (error) {
    logger.error('Error seeding store:', error);
    throw error;
  } finally {
    await app.close();
  }
}

bootstrap();
