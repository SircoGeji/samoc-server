import * as controller from '../controllers/upload';
import { returnNotAllowed } from '../controllers/notallowed';
import express = require('express');
import multer = require('multer');

const upload = express.Router({ mergeParams: true });

/**
 * List s3 buckets
 * POST /api/uploadImage
 */
upload.get('/list', controller.list);

/**
 * Create a new image in s3
 * POST /api/uploadImage
 */
upload.post('/', multer().single('uploadFile'), controller.uploadImage);

/**
 * Not allowed handler
 */
upload.all('/', returnNotAllowed(['get', 'post']));
upload.all('/list', returnNotAllowed(['get']));

export default upload;
