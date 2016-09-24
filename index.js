'use strict';

var GOOGLE_VISION_API_KEY = 'AIzaSyCMHDy3VglnLi72j-MYxFvQB413deiZDZw';
var FOOD_LABELS = ['fish','milk','bread'];
var FOOD_LABEL_MIN_SCORE = 0.5;
var DETECTION_MAX_LABELS = 100;
var DYNAMO_TABLE = 'dynamic-yield-exercise';
var DYNAMO_PK = 'cat';
var LAST_FOOD_TIME_ATTR = 'last_food_time';
var LAST_FOOD_NOTIFIED_ATTR = 'last_food_notified';
var NOTIFICATION_TOPIC_ARN = 'arn:aws:sns:eu-west-1:776897963456:dye-cat';

var aws = require('aws-sdk');
var vision = require('node-cloud-vision-api');
var Promise = require('bluebird');
var _ = require('underscore');

var s3 = new aws.S3({apiVersion: '2006-03-01'});
var dynamodb = new aws.DynamoDB({apiVersion: '2012-08-10'});
var sns = new aws.SNS({apiVersion: '2010-03-31'});

vision.init({auth: GOOGLE_VISION_API_KEY});

exports.handler = function(event, context, callback){
    var bucket = event.Records[0].s3.bucket.name;
    var key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    console.log('New object: bucket - '+bucket+', key - '+key);

    Promise.promisify(s3.getObject,{context:s3})({
        Bucket: bucket,
        Key: key,
    }).then(function(data){
        console.log('Object retrieved from S3 successfully');

        return detectLabels(data.Body).then(function(labels) {
            console.log("Image processed by Google Vision API successfully. " + labels.length + " labels detected");
            console.log(labels);

            return _.find(labels, isFoodLabel);
        });
    }).then(function(foodLabel) {
        if (foodLabel) {
            console.log('Found a FOOD label! (' + foodLabel.description + ')');

            return handleFood().then(function (notify) {
                if (notify) {
                    console.log('The cat is not hungry anymore - NOTIFY');
                    return notifyBackToNormal();
                }
            });
        }

        console.log('No food label found');
    }).then(callback,callback);
};

function detectLabels(imageBuffer){
    return vision.annotate(new vision.Request({
        image: new vision.Image({base64: imageBuffer.toString('base64')}),
        features: [
            new vision.Feature('LABEL_DETECTION', DETECTION_MAX_LABELS)
        ]
    })).then(function(res){
        if(!res.responses || !res.responses.length || !res.responses[0].labelAnnotations){
            throw 'Could not determine labels from Google Vision API respose';
        }
        return res.responses[0].labelAnnotations;
    });
}

function isFoodLabel(lbl){
    return lbl.score>=FOOD_LABEL_MIN_SCORE && FOOD_LABELS.indexOf(lbl.description)>=0;
}

function handleFood(){
    return Promise.promisify(dynamodb.updateItem,{context:dynamodb})({
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
    }).then(function(data){
        console.log('Last food time was updated successfully');

        return data.Attributes.last_food_notified.BOOL;
    });
}

function notifyBackToNormal(){
    return Promise.promisify(sns.publish,{context:sns})({
        Subject: '[BACK TO NORMAL] The cat is no longer hungry',
        Message: 'Great News! You can sit down and relax, the cat is no longer hungry.',
        TopicArn: NOTIFICATION_TOPIC_ARN
    })
}