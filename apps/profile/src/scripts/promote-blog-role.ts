#!/usr/bin/env ts-node

/**
 * Script to promote a user to blog poster or owner
 * Usage: npm run promote-blog-role <userId> <role>
 * Role can be: 'poster' or 'owner'
 * 
 * Example:
 * npm run promote-blog-role user-123 poster
 * npm run promote-blog-role user-456 owner
 */

import { DataSource } from 'typeorm';
import { Profile, BlogRole } from '../profiles/entities/profile.entity';
import * as config from '../config';

async function promoteBlogRole(userId: string, role: string) {
  const validRoles = ['poster', 'owner', 'none'];
  
  if (!validRoles.includes(role.toLowerCase())) {
    console.error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  const blogRole = role.toLowerCase() as BlogRole;
  
  // Initialize data source
  const dbConfig = config.default();
  const dataSource = new DataSource({
    type: 'postgres',
    host: dbConfig.database.host,
    port: dbConfig.database.port,
    username: dbConfig.database.username,
    password: dbConfig.database.password,
    database: dbConfig.database.database,
    entities: [Profile],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const profileRepository = dataSource.getRepository(Profile);
    
    // Find profile by userId
    const profile = await profileRepository.findOne({ where: { userId } });
    
    if (!profile) {
      console.error(`Profile not found for userId: ${userId}`);
      await dataSource.destroy();
      process.exit(1);
    }

    const oldRole = profile.blogRole || BlogRole.NONE;
    
    // Update blog role
    profile.blogRole = blogRole;
    await profileRepository.save(profile);
    
    console.log(`Successfully updated blog role for user ${userId}`);
    console.log(`  Profile ID: ${profile.id}`);
    console.log(`  Profile Name: ${profile.profileName}`);
    console.log(`  Old Role: ${oldRole}`);
    console.log(`  New Role: ${blogRole}`);
    
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error promoting user:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error('Usage: npm run promote-blog-role <userId> <role>');
  console.error('Role can be: poster, owner, or none');
  process.exit(1);
}

const [userId, role] = args;

promoteBlogRole(userId, role);
