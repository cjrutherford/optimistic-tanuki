import { ClientProxyFactory, Transport, ClientProxy } from "@nestjs/microservices";
import { CreatePersonaTelosDto } from "@optimistic-tanuki/models";
import personas from '../assets/personas.json';
import { loadConfig } from "./config";
import { firstValueFrom } from "rxjs";
import { PersonaTelosCommands } from "@optimistic-tanuki/constants";

async function main() {
    const config = loadConfig();
    const port = Number(config.listenPort) || 3008;

    const client: ClientProxy = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: {
            host: 'localhost',
            port: port
        }
    });

    await client.connect();

    for (const persona of personas) {
        const dto: CreatePersonaTelosDto = {...persona};

        await firstValueFrom(client.send({ cmd: PersonaTelosCommands.CREATE }, dto))
    }

    await client.close();
}

main().catch(console.error);