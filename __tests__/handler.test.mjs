import { handler } from '../index.mjs';
import jwt from 'jsonwebtoken';
import AWS from 'aws-sdk';

// Resetting modules to ensure a clean mock state
beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jwt.decode.mockClear();
});

// Mock jwt library
jest.mock('jsonwebtoken', () => ({
    decode: jest.fn(),
}));

// Mock AWS library
jest.mock('aws-sdk', () => {

    const getMock = jest.fn();
    const scanMock = jest.fn();
    const updateMock = jest.fn();

    return {
        DynamoDB: {
            DocumentClient: jest.fn(() => ({
                get: jest.fn(() => ({ promise: getMock })),
                scan: jest.fn(() => ({ promise: scanMock })),
                update: jest.fn(() => ({ promise: updateMock }))
            })),
        },
        getMock,
        scanMock,
        updateMock
    };
});


describe('handler function tests', () => {
    // SET UP RESPONSES
    const event = {
        headers: {
            Authorization: 'Bearer <token>',
        },
    };
    const position_old = JSON.stringify({ 'user1': 1, 'user2': 2 });
    const user_id = "user123";
    const bucket_id = "bucket123";
    const position_new = { user1: 3, user2: 4 };
    const aggregate_skills_season = { user1: 100, user2: 200 };

    const mockScanResponse = {
        Items: [
            { user_id: 'user1', position_new: position_new.user1, aggregate_skills_season: aggregate_skills_season.user1, username: 'user1' },
            { user_id: 'user2', position_new: position_new.user2, aggregate_skills_season: aggregate_skills_season.user2, username: 'user2' },
        ]
    };
    const mockGetResponse = { Item: { user_id, bucket_id, position_old } };
    const mockUpdateResponse = {};


    it('should return correct response when JWT token is valid', async () => {
        jwt.decode.mockReturnValueOnce({ sub: 'user123' });
        AWS.getMock.mockResolvedValueOnce(mockGetResponse);
        AWS.scanMock.mockResolvedValueOnce(mockScanResponse);
        AWS.updateMock.mockResolvedValueOnce(mockUpdateResponse);

        const result = await handler(event);

        expect(result.statusCode).toBe(200);
        expect(result.body).toBeDefined();

        const responseBody = JSON.parse(result.body);
        const parsedPositionOld = JSON.parse(position_old);

        expect(responseBody).toEqual([
            {
                username: "user1",
                position_new: position_new.user1,
                position_old: parsedPositionOld['user1'],
                aggregate_skills_season: aggregate_skills_season.user1,
            },
            {
                username: "user2",
                position_new: position_new.user2,
                position_old: parsedPositionOld['user2'],
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
