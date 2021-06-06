import {
    CFToolsClient,
    Game,
    GameServerItem,
    GetLeaderboardRequest,
    GetPlayerDetailsRequest,
    GetPriorityQueueRequest,
    LeaderboardItem,
    Player,
    PriorityQueueItem, ServerApiId,
    Statistic,
    SteamId64
} from '../types';
import {CachingCFToolsClient} from './caching-cftools-client';
import {InMemoryCache} from './in-memory-cache';

describe('CachingCFToolsClient', () => {
    let client: CFToolsClient;
    let stubClient: CFToolsClient;

    beforeEach(() => {
        stubClient = {
            deletePriorityQueue: jest.fn(),
            getGameServerDetails: jest.fn(),
            getLeaderboard: jest.fn(),
            getPlayerDetails: jest.fn(),
            getPriorityQueue: jest.fn(),
            putPriorityQueue: jest.fn(),
        };
        client = new CachingCFToolsClient(new InMemoryCache(), {
            priorityQueue: 30,
            playerDetails: 30,
            gameServerDetails: 30,
            leaderboard: 30,
        }, stubClient, ServerApiId.of('AN_ID'));
    });

    describe('caches', () => {
        it('getGameServerDetails', async () => {
            stubClient.getGameServerDetails = jest.fn(() => Promise.resolve({
                name: 'someName'
            } as GameServerItem));
            const request = {
                game: Game.DayZ,
                ip: '127.0.0.1',
                port: 2302,
            };
            const firstResponse = await client.getGameServerDetails(request);
            const secondResponse = await client.getGameServerDetails(request);

            expect(stubClient.getGameServerDetails).toHaveBeenCalledTimes(1);
            expect(firstResponse).toEqual(secondResponse);
        });

        it('getPlayerDetails', async () => {
            stubClient.getPlayerDetails = jest.fn(() => Promise.resolve({
                names: ['A_NAME']
            } as Player));
            const request: GetPlayerDetailsRequest = {
                playerId: SteamId64.of('123456789'),
            };
            const firstResponse = await client.getPlayerDetails(request);
            const secondResponse = await client.getPlayerDetails(SteamId64.of('123456789'));

            expect(stubClient.getPlayerDetails).toHaveBeenCalledTimes(1);
            expect(firstResponse).toEqual(secondResponse);
        });

        it('getPriorityQueue', async () => {
            stubClient.getPriorityQueue = jest.fn(() => Promise.resolve({
                comment: 'SOME_COMMENT'
            } as PriorityQueueItem));
            const request: GetPriorityQueueRequest = {
                playerId: SteamId64.of('123456789'),
            };
            const firstResponse = await client.getPriorityQueue(request);
            const secondResponse = await client.getPriorityQueue(SteamId64.of('123456789'));

            expect(stubClient.getPriorityQueue).toHaveBeenCalledTimes(1);
            expect(firstResponse).toEqual(secondResponse);
        });

        it('getLeaderboard', async () => {
            stubClient.getLeaderboard = jest.fn(() => Promise.resolve([{
                name: 'A_NAME'
            }] as LeaderboardItem[]));
            const request: GetLeaderboardRequest = {
                statistic: Statistic.KILLS,
                order: 'DESC'
            };
            const firstResponse = await client.getLeaderboard(request);
            const secondResponse = await client.getLeaderboard(request);

            expect(stubClient.getLeaderboard).toHaveBeenCalledTimes(1);
            expect(firstResponse).toEqual(secondResponse);
        });
    });

    describe('does not cache', () => {
        it('deletePriorityQueue', async () => {
            await client.deletePriorityQueue(SteamId64.of('123456789'));
            await client.deletePriorityQueue(SteamId64.of('123456789'));

            expect(stubClient.deletePriorityQueue).toHaveBeenCalledTimes(2);
        });

        it('putPriorityQueue', async () => {
            const request = {
                id: SteamId64.of('123456789'),
                comment: 'SOME_TEXT'
            };
            await client.putPriorityQueue(request);
            await client.putPriorityQueue(request);

            expect(stubClient.putPriorityQueue).toHaveBeenCalledTimes(2);
        });
    });
});
