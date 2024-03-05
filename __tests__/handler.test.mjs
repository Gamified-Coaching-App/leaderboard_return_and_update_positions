import { handler } from '../index.mjs';
import jwt from 'jsonwebtoken';

// Mock jwt library
jest.mock('jsonwebtoken', () => ({
    decode: jest.fn(),
}));

const user_id = 'user123';
const bucket_id = 1;
const position_old = { user1: 1, user2: 2 };
const position_new = { user1: 3, user2: 4 };
const aggregate_skills_season = { user1: 100, user2: 200 };

jest.mock('aws-sdk', () => {
    const position_old = JSON.stringify({ user1: 1, user2: 2 });
    const user_id = 'user123';
    const bucket_id = 'bucket123';
    const position_new = { user1: 3, user2: 4 };
    const aggregate_skills_season = { user1: 100, user2: 200 };

    const mockGet = jest.fn(() => ({ promise: () => Promise.resolve({ Item: { user_id, bucket_id, position_old } }) }));
    const mockScan = jest.fn(() => ({
        promise: () => Promise.resolve({
            Items: [
                { user_id: 'user1', position_new: position_new.user1, aggregate_skills_season: aggregate_skills_season.user1, username: 'user1' },
                { user_id: 'user2', position_new: position_new.user2, aggregate_skills_season: aggregate_skills_season.user2, username: 'user2' },
            ]
        })
    }));

    // Simulate the global dynamoDb with the same mocked behavior as documentClient
    global.dynamoDb = {
        get: mockGet,
        scan: mockScan,
    };

    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                get: mockGet,
                scan: mockScan,
            })),
        },
    };
});


describe('handler function tests', () => {
    const event = {
        headers: {
            Authorization: 'Bearer <token>',
        },
    };

    afterEach(() => {
        // Reset the mocks after each test if necessary
        global.dynamoDb.get.mockClear();
        global.dynamoDb.scan.mockClear();
        jwt.decode.mockClear();
    });

    it('should return correct response when JWT token is valid', async () => {
        jwt.decode.mockReturnValueOnce({ sub: 'user123' });

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toBeDefined();

        const responseBody = JSON.parse(result.body);
        // console.log(position_old.user1);
        expect(responseBody).toEqual([
            {
                username: "user1",
                position_new: position_new.user1,
                position_old: position_old.user1,
                aggregate_skills_season: aggregate_skills_season.user1,
            },
            {   username: "user2",
                position_new: position_new.user2,
                position_old: position_old.user2,
                aggregate_skills_season: aggregate_skills_season.user2,
            }]
        );
    });

    it('should return correct response when JWT token is invalid', async () => {
        jwt.decode.mockReturnValueOnce(null);

        const result = await handler(event);

        expect(result.statusCode).toBe(500);
        expect(result.body).toBeDefined();

        const responseBody = JSON.parse(result.body);

        expect(responseBody).toEqual({ message: 'Internal Server Error' });
    });

});
