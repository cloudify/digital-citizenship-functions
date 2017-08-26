import {IContext} from "./context";
import * as express from "express";

declare module "express" {
  interface Request {
    context: IContext;
  }
}
