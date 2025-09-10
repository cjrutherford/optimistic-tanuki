import personas from '../assets/personas.json';
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { PersonaTelos } from "./entities";
import { Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const personaTelosRepo = app.get<Repository<PersonaTelos>>(getRepositoryToken(PersonaTelos));
    console.dir(personaTelosRepo)

    for(const persona of personas) {
        const existingPersona = await personaTelosRepo.findOneBy({ name: persona.name });
        if (existingPersona) {
            console.log(`Persona ${persona.name} already exists, skipping.`);
            continue;
        }

       const newPersona = personaTelosRepo.create(persona);
       await personaTelosRepo.save(newPersona);
       console.log(`Created new persona: ${newPersona.name}`);
    }
}

main().catch(console.error);