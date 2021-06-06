import {
    AuthenticationRequired,
    CFToolsClient, CFToolsId, DeletePriorityQueueRequest, DeleteWhitelistRequest, GameServerItem,
    GenericId, GetGameServerDetailsRequest,
    GetLeaderboardRequest,
    GetPlayerDetailsRequest, GetPriorityQueueRequest, GetWhitelistRequest, LeaderboardItem,
    LoginCredentials, OverrideServerApiId,
    Player, PriorityQueueItem, PutPriorityQueueItemRequest, PutWhitelistItemRequest,
    ServerApiId, ServerApiIdRequired, WhitelistItem
} from '../../types';
import {CFToolsAuthorizationProvider} from '../auth';
import {get, httpDelete, post} from '../http';
import {URLSearchParams} from 'url';
import crypto from 'crypto';
import {
    GetGameServerDetailsResponse,
    GetLeaderboardResponse,
    GetPlayerResponse,
    GetPriorityQueueEntry,
    GetUserLookupResponse, toHitZones, toWeaponBreakdown
} from './types';
import {asDate} from './date-to-string';

export class GotCFToolsClient implements CFToolsClient {
    private readonly auth?: CFToolsAuthorizationProvider;

    constructor(private serverApiId?: ServerApiId, credentials?: LoginCredentials) {
        if (credentials) {
            this.auth = new CFToolsAuthorizationProvider(credentials);
        }
    }

    async getPlayerDetails(playerId: GetPlayerDetailsRequest | GenericId): Promise<Player> {
        this.assertAuthentication();
        const id = await this.resolve(playerId);
        const response = await get<GetPlayerResponse>(
            `v1/server/${this.resolveServerApiId('serverApiId' in playerId ? playerId : undefined).id}/player`,
            {
                searchParams: {
                    cftools_id: id.id,
                },
                headers: {
                    Authorization: 'Bearer ' + await this.auth!.provideToken()
                }
            }
        );
        const player = response[id.id];
        return {
            names: player.omega.name_history,
            statistics: {
                kills: player.game.general.kills || 0,
                deaths: player.game.general.deaths || 0,
                suicides: player.game.general.suicides || 0,
                environmentDeaths: player.game.general.environment_deaths || 0,
                infectedDeaths: player.game.general.infected_deaths || 0,
                hits: player.game.general.hits || 0,
                longestShot: player.game.general.longest_shot || 0,
                longestKill: player.game.general.longest_kill || 0,
                weaponsBreakdown: toWeaponBreakdown(player.game.general.weapons),
                hitZones: toHitZones(player.game.general.zones),
                killDeathRatio: player.game.general.kdratio || 0,
            },
            playtime: player.omega.playtime,
            sessions: player.omega.sessions,
        };
    }

    async getLeaderboard(request: GetLeaderboardRequest): Promise<LeaderboardItem[]> {
        this.assertAuthentication();
        const params = new URLSearchParams();
        params.append('stat', request.statistic);
        if (request.order === 'ASC') {
            params.append('order', '-1');
        } else {
            params.append('order', '1');
        }
        if (request.limit && request.limit > 0 && request.limit <= 100) {
            params.append('limit', request.limit.toString());
        }
        const response = await get<GetLeaderboardResponse>(`v1/server/${this.resolveServerApiId(request).id}/leaderboard`, {
            searchParams: params,
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            }
        });
        return response.leaderboard.map((raw) => {
            return {
                name: raw.latest_name,
                rank: raw.rank,
                suicides: raw.suicides || 0,
                environmentDeaths: raw.environment_deaths || 0,
                kills: raw.kills || 0,
                deaths: raw.deaths || 0,
                playtime: raw.playtime,
                id: CFToolsId.of(raw.cftools_id),
                hits: raw.hits,
                killDeathRation: raw.kdratio,
                longestKill: raw.longest_kill,
                longestShot: raw.longest_shot,
            } as LeaderboardItem;
        });
    }

    async getPriorityQueue(playerId: GetPriorityQueueRequest | GenericId): Promise<PriorityQueueItem | null> {
        this.assertAuthentication();
        const id = await this.resolve(playerId);
        const response = await get<GetPriorityQueueEntry>(`v1/server/${this.resolveServerApiId('serverApiId' in playerId ? playerId : undefined).id}/queuepriority`, {
            searchParams: {
                cftools_id: id.id,
            },
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            }
        });
        if (response.entries.length === 0) {
            return null;
        }
        const entry = response.entries[0];
        return {
            createdBy: CFToolsId.of(entry.creator.cftools_id),
            comment: entry.meta.comment,
            expiration: entry.meta.expiration ? asDate(entry.meta.expiration) : 'Permanent',
            created: new Date(entry.created_at)
        } as PriorityQueueItem;
    }

    async putPriorityQueue(request: PutPriorityQueueItemRequest): Promise<void> {
        this.assertAuthentication();
        let expires = '';
        if (request.expires && request.expires !== 'Permanent') {
            expires = request.expires.toISOString();
        }
        await post(`v1/server/${this.resolveServerApiId(request).id}/queuepriority`, {
            body: JSON.stringify({
                cftools_id: request.id.id,
                comment: request.comment,
                expires_at: expires
            }),
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            },
        });
    }

    async deletePriorityQueue(playerId: DeletePriorityQueueRequest | GenericId): Promise<void> {
        this.assertAuthentication();
        const id = await this.resolve(playerId);
        await httpDelete(`v1/server/${this.resolveServerApiId('serverApiId' in playerId ? playerId : undefined).id}/queuepriority`, {
            searchParams: {
                cftools_id: id.id
            },
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            },
        });
    }

    async getWhitelist(playerId: GetWhitelistRequest | GenericId): Promise<WhitelistItem | null> {
        this.assertAuthentication();
        const id = await this.resolve(playerId);
        const response = await get<GetPriorityQueueEntry>(`v1/server/${this.resolveServerApiId('serverApiId' in playerId ? playerId : undefined).id}/whitelist`, {
            searchParams: {
                cftools_id: id.id,
            },
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            }
        });
        if (response.entries.length === 0) {
            return null;
        }
        const entry = response.entries[0];
        return {
            createdBy: CFToolsId.of(entry.creator.cftools_id),
            comment: entry.meta.comment,
            expiration: entry.meta.expiration ? asDate(entry.meta.expiration) : 'Permanent',
            created: new Date(entry.created_at)
        } as WhitelistItem;
    }

    async putWhitelist(request: PutWhitelistItemRequest): Promise<void> {
        this.assertAuthentication();
        let expires = '';
        if (request.expires && request.expires !== 'Permanent') {
            expires = request.expires.toISOString();
        }
        await post(`v1/server/${this.resolveServerApiId(request).id}/whitelist`, {
            body: JSON.stringify({
                cftools_id: request.id.id,
                comment: request.comment,
                expires_at: expires
            }),
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            },
        });
    }

    async deleteWhitelist(playerId: DeleteWhitelistRequest | GenericId): Promise<void> {
        this.assertAuthentication();
        const id = await this.resolve(playerId);
        await httpDelete(`v1/server/${this.resolveServerApiId('serverApiId' in playerId ? playerId : undefined).id}/whitelist`, {
            searchParams: {
                cftools_id: id.id
            },
            headers: {
                Authorization: 'Bearer ' + await this.auth!.provideToken()
            },
        });
    }

    async getGameServerDetails(request: GetGameServerDetailsRequest): Promise<GameServerItem> {
        const hash = crypto.createHash('sha1');
        hash.update(request.game);
        hash.update(request.ip);
        hash.update(request.port.toString(10));
        const serverResource = hash.digest('hex');

        const response = await get<GetGameServerDetailsResponse>(`v1/gameserver/${serverResource}`);
        const server = response[serverResource];
        return {
            name: server.name,
            version: server.version,
            status: {
                players: {
                    slots: server.status.slots,
                    online: server.status.players,
                    queue: server.status.queue.size,
                },
            },
            security: {
                vac: server.security.vac,
                battleye: server.security.battleye,
                password: server.security.password,
            },
            rating: server.rating,
            rank: server.rank,
            online: server.online,
            map: server.map,
            mods: server.mods.map((m) => {
                return {
                    name: m.name,
                    fileId: m.file_id,
                };
            }),
            geolocation: {
                timezone: server.geolocation.timezone,
                country: server.geolocation.country,
                continent: server.geolocation.continent,
                city: server.geolocation.city,
                available: server.geolocation.available,
            },
            environment: {
                perspectives: {
                    firstPersonPerspective: server.environment.perspectives['1rd'],
                    thirdPersonPerspective: server.environment.perspectives['3rd'],
                },
                timeAcceleration: server.environment.time_acceleration,
                time: server.environment.time,
            },
            attributes: {
                dlc: server.attributes.dlc,
                dlcs: server.attributes.dlcs,
                official: server.attributes.official,
                modded: server.attributes.modded,
                hive: server.attributes.hive,
                experimental: server.attributes.experimental,
                whitelist: server.attributes.whitelist,
            },
            host: {
                address: server.host.address,
                gamePort: server.host.game_port,
                queryPort: server.host.query_port,
            },
        } as GameServerItem
    }

    private assertAuthentication() {
        if (!this.auth) {
            throw new AuthenticationRequired();
        }
    }

    private resolveServerApiId(request?: OverrideServerApiId): ServerApiId {
        if (request?.serverApiId) {
            return request.serverApiId;
        }
        if (this.serverApiId) {
            return this.serverApiId;
        }
        throw new ServerApiIdRequired();
    }

    private async resolve(id: GenericId | { playerId: GenericId }): Promise<CFToolsId> {
        let playerId: GenericId;
        if ('playerId' in id) {
            playerId = id.playerId;
        } else {
            playerId = id;
        }
        if (playerId instanceof CFToolsId) {
            return playerId;
        }

        const response = await get<GetUserLookupResponse>('v1/users/lookup', {
            searchParams: {
                identifier: playerId.id,
            },
        });
        return CFToolsId.of(response.cftools_id);
    }
}
