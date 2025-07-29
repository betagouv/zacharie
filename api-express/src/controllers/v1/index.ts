import express from 'express';
import feiRouter from './fei.ts';

const app = express();

app.use('/fei', feiRouter);
