# Deployment checklist

The site is not deployed yet.

## Repository

Create a separate public repository named `reason-engine-web`. Do not publish the private Reason Engine system repository.

Recommended branch flow:

1. initialize `main` with a minimal README;
2. create `website/v0.1`;
3. add this package on that branch;
4. open a Draft pull request;
5. review wording, legal pages, links, mobile layout and accessibility;
6. merge only after explicit approval.

## Legal and contact gate

Publication remains blocked until:

- the Impressum contains verified mandatory information;
- the privacy notice matches the selected host and final technical configuration;
- the public contact address exists and has been tested;
- the site owner has approved publication.

## GitHub Pages candidate path

After repository review:

1. enable Pages from the approved branch or a dedicated deployment workflow;
2. verify the temporary Pages URL;
3. add `reasonengine.de` as the custom domain;
4. copy `CNAME.example` to `CNAME` only when the domain mapping is approved;
5. set the DNS records in IONOS according to the exact values shown by the selected host;
6. enable HTTPS only after certificate issuance is confirmed;
7. configure `reasonengine.org` as a redirect to the canonical `.de` address;
8. remove `noindex,nofollow` and the blanket `robots.txt` block only after the public launch decision.

Never guess DNS values. Read them from the live hosting configuration at deployment time.
