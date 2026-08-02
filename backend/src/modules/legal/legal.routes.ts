import { Router, type Response } from "express";
import { accountDeletionHtml, privacyPolicyHtml, termsHtml } from "./legal.pages.js";

export const legalRouter = Router();

function sendLegalPage(response: Response, html: string) {
  response
    .status(200)
    .set({
      "Cache-Control": "public, max-age=300",
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    })
    .send(html);
}

legalRouter.get("/privacy", (_request, response) => {
  sendLegalPage(response, privacyPolicyHtml);
});

legalRouter.get("/terms", (_request, response) => {
  sendLegalPage(response, termsHtml);
});

legalRouter.get("/account-deletion", (_request, response) => {
  sendLegalPage(response, accountDeletionHtml);
});
