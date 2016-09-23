'use strict';

var GOOGLE_VISION_API_KEY = 'AIzaSyCMHDy3VglnLi72j-MYxFvQB413deiZDZw';
var FOOD_LABELS = ['fish','milk','bread'];
var FOOD_LABEL_MIN_SCORE = 0.5;
var DETECTION_MAX_LABELS = 100;
var DYNAMO_TABLE = 'dynamic-yield-exercise';
var DYNAMO_PK = 'cat';
var LAST_FOOD_TIME_ATTR = 'last_food_time';
var LAST_FOOD_NOTIFIED_ATTR = 'last_food_notified';

var aws = require('aws-sdk');
var vision = require('node-cloud-vision-api');

var s3 = new aws.S3({apiVersion: '2006-03-01'});
var dynamodb = new aws.DynamoDB({apiVersion: '2012-08-10'});

vision.init({auth: GOOGLE_VISION_API_KEY});

exports.handler = function(event, context, callback){
    var bucket = event.Records[0].s3.bucket.name;
    var key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    console.log('New object: bucket - '+bucket+', key - '+key);

    s3.getObject({
        Bucket: bucket,
        Key: key,
    }, function(err, data){
        if (err) {
            console.error(err);
            return callback(err);
        }

        console.log('Object retrieved from S3 successfully');

        vision.annotate(new vision.Request({
            image: new vision.Image({base64: data.Body.toString('base64')}),
            features: [
                new vision.Feature('LABEL_DETECTION', DETECTION_MAX_LABELS)
            ]
        })).then(function(res){
            console.log("Image process by Google Vision API successfully");

            if(!res.responses || !res.responses.length || !res.responses[0].labelAnnotations){
                return callback('Bad response from Google Vision API');
            }

            var labels = res.responses[0].labelAnnotations;
            console.log("Detected "+labels.length+" labels");
            console.log(labels);

            for(var i=0;i<labels.length;i++){
                var lbl = labels[i];
                if(lbl.score>=FOOD_LABEL_MIN_SCORE && FOOD_LABELS.indexOf(lbl.description)>=0){
                    console.log('Found a FOOD label with the required minimal score! ('+lbl.description+')');

                    dynamodb.updateItem({
                        TableName: DYNAMO_TABLE,
                        Key: {
                            key: {S: DYNAMO_PK}
                        },
                        UpdateExpression: 'SET '+LAST_FOOD_TIME_ATTR+' = :time, '+LAST_FOOD_NOTIFIED_ATTR+' = :notified',
                        ExpressionAttributeValues: {
                            ':time': {N: ""+Date.now()},
                            ':notified': {BOOL: false}
                        },
                        ReturnValues: 'ALL_OLD'
                    },function(err,data){
                        if(err){
                            console.error('Failed to update last food time');
                            return callback(err);
                        }
                        console.log('Last food time was updated successfully');

                        callback(null,data);
                    });
                    return;
                }
            }

            console.log('No food label found');

            callback();
        },function(err){
            console.error(err);
            callback(err);
        });
    });
};