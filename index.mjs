import AWS from 'aws-sdk';
import jwt from 'jsonwebtoken';

const dynamoDb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    try {
        // Extract user_id from JWT token
        const authorizationHeader = event.headers.Authorization || event.headers.authorization; // Assuming the token is in the format "Bearer <token>"
        console.log(authorizationHeader);
        let token;
        if (authorizationHeader.startsWith('Bearer')) {
            // Split the header value by space and return the second part
            token = authorizationHeader.split(' ')[1];
        } else {
            // If "Bearer" prefix is not present, assume the whole header value is the token
            token = authorizationHeader;
        }
       
        // console.log(token);
        const decoded = jwt.decode(token);
        // console.log(decoded);
        const user_id = decoded.sub;
        console.log("Decoded JWT user ID:", user_id);

        // Assign variable to user's position_old and bucket_id (bucket_id is needed for generating later queries)
        const old_pos_params = {
            TableName: "leaderboard",
            Key: {
                "user_id": user_id
            },
            ProjectionExpression: "bucket_id, position_old"
        };

        const old_position_data = await dynamoDb.get(old_pos_params).promise();
        const old_positions_string = old_position_data.Item.position_old;
        console.log(old_positions_string);
        const old_positions = JSON.parse(old_positions_string);
        const bucket_id = old_position_data.Item.bucket_id;
        console.log(typeof old_positions_string);
        console.log(typeof old_positions);

        // Check if bucket_id is -1
        if (bucket_id === -1) {
            console.log("No leaderboard info available!");
            return JSON.stringify({ message: "No leaderboard info available!" });
        }

        // Generate new current_positions based on new_positions for the bucket
        // Also get latest aggregate skills points for all users in the bucket
        const current_params = {
            TableName: "leaderboard",
            FilterExpression: "bucket_id = :bucket_id",
            ExpressionAttributeValues: {
                ":bucket_id": bucket_id
            }
        };
        const current_data = await dynamoDb.scan(current_params).promise();
        const current_positions = {};
        const agg_skills = {};
        current_data.Items.forEach(item => {
            // current_positions[item.user_id] = item.position_new;
            current_positions[item.username] = item.position_new;
            // agg_skills[item.user_id] = item.aggregate_skills_season;
            agg_skills[item.username] = item.aggregate_skills_season;
        });
        //const current_positions = JSON.stringify(current_positions_data);
        console.log("Current positions created!");
        console.log(typeof current_positions);
        //const agg_skills = JSON.stringify(agg_skills_data);
        console.log("Aggregate skills pulled!");
        console.log(typeof agg_skills);


        // Update DB's position_old with the new positions_old
        // const updateParams = {
        //     TableName: "leaderboard",
        //     Key: { "user_id": user_id },
        //     UpdateExpression: "set position_old = :position_old",
        //     ExpressionAttributeValues: {
        //         ":position_old": JSON.stringify(current_positions)
        //     },
        // };
        // await dynamoDb.update(updateParams).promise();
        // console.log("Dynamo DB all updated!");


        // Combine data into required format
        const result = {};

        // Iterate over the keys of the first object
        for (let key in current_positions) {
            // Check if the key exists in all three objects
            if (current_positions.hasOwnProperty(key) && old_positions.hasOwnProperty(key) && agg_skills.hasOwnProperty(key)) {
                // Construct the final object with nested structure
                result[key] = {
                    "position_new": current_positions[key],
                    "position_old": old_positions[key],
                    "aggregate_skills_season": agg_skills[key]
                };
            }
        }

        console.log("Data successfully packaged up!");
        console.log(typeof result);
        console.log(result);

        // Create a JSON object to return to the frontend
        const responseObject = {
            statusCode: 200,
            headers: get_headers(),
            body: JSON.stringify(result) // Convert data to JSON string
        };

        return responseObject;

    } catch (error) {
        console.error('Error:', error);

        // If an error occurs, return an error response
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error' })
        };

    }

}

function get_headers() {
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "OPTIONS,GET"
    };
}