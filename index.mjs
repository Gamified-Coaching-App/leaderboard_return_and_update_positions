import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    console.log("hello!");
    // Extract user_id from JWT token
    const token = event.headers.Authorization || event.headers.authorization; // Assuming the token is in the format "Bearer <token>"
    console.log(token);
    const decoded = jwt.decode(token);
    console.log(decoded);
    const user_id = decoded.sub;
    console.log("Decoded JWT user ID:", user_id);

    // Assign variable to user's position_old and bucket_id
    const old_pos_params = {
        TableName: "leaderboard",
        Key: {
            "user_id": user_id
        },
        ProjectionExpression: "bucket_id, position_old"
    };

    const old_position_data = await dynamoDb.get(old_pos_params).promise();
    const old_position_old = old_position_data.Item.position_old;
    console.log(old_position_old);
    const bucket_id = old_position_data.Item.bucket_id;

    // Generate new position_old based on new_positions for the bucket
    const new_pos_params = {
        TableName: "leaderboard",
        FilterExpression: "bucket_id = :bucket_id",
        ExpressionAttributeValues: {
            ":bucket_id": bucket_id
        }
    };
    const new_position_data = await dynamoDb.scan(new_pos_params).promise();
    const position_old_updated = {};
    new_position_data.Items.forEach(item => {
        position_old_updated[item.user_id] = item.position_new;
    });
    const new_position_old = JSON.stringify(position_old_updated);
    console.log("New position_old created!");


    // Update DB's position_old with the new positions_old
    const updateParams = {
        TableName: "leaderboard",
        Key: { "user_id": user_id },
        UpdateExpression: "set position_old = :position_old",
        ExpressionAttributeValues: {
            ":position_old": new_position_old
        },
    };
    await dynamoDb.update(updateParams).promise();
    console.log("Dynamo DB all updated!");

    // return old positions_old, new positions_old
    return JSON.stringify({ "old_position_old": old_position_old, "new_position_old": new_position_old });
}
