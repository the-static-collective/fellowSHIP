# fellowSHIP — Vision

> A shared place to turn what we have, what we know, and what we can do into things we accomplish together.

**Status:** Vision and exploratory proposals, not evidence of deployed functionality.  
**Scope:** This document describes the horizon; it is not an implementation requirement or permission to modify foundational architecture.  
**Updated:** 2026-11-21

## Purpose

fellowSHIP is a community-owned digital makerspace for churches and neighboring organizations. Each person may contribute through a web interface, an AI assistant, or another supported client. Every church can maintain its own working rooms while participating in projects with other churches and individuals.

An AI is a collaborator's tool, not the authority over a community. The durable project record—not an individual conversation—is the shared source of truth.

### Guiding principles

1. **People first.** Non-AI participation must be first-class; no one should need a ChatGPT subscription to contribute.
2. **Local identity, shared work.** Communities control their own spaces, governance, membership, and representation.
3. **Rooms are relationships, not just folders.** Projects can be associated with multiple churches, people, and wider networks without copying or exposing entire private rooms.
4. **Consent and stewardship.** Sensitive pastoral, family, financial, and children's information is private by default. Cross-room sharing requires explicit permission.
5. **Proof-carrying coordination.** Record proposals, approvals, responsible participants, decisions, sources, work done, and outstanding uncertainties. AI suggestions do not equal human commitments.
6. **Portable and interoperable.** A public web interface and an authenticated API can coexist with optional MCP integrations and other clients.
7. **Make real-world outcomes visible.** Ideas become projects, offers meet needs, work gets done, and records remain understandable to new collaborators.

## Nested and intersecting commons

A participant may belong to one church, several projects, and an inter-church coalition. Church rooms can host smaller rooms (music, food, worship, events, service, education), while projects such as FELLOWSHIP can belong to more than one community.

A proposed shared-resource graph could link offers, needs, skills, equipment, scheduling, volunteer availability, and verified deliveries. Organizations grant access to the particular shared objects they elect to publish, not to their private data stores.

## Future direction — fellowSHIP Radio: a station of stations

**Status: Vision proposal / not approved implementation scope.**

Each participating church may operate its own internet radio station, with a creative studio connected to fellowSHIP's collaborative rooms. The wider network may offer a voluntary **station of stations**: a listener-facing directory, thematic discovery service, and collaborative programming channel that spans consenting stations while preserving their individual identities.

### Creation-to-broadcast path (proposed)

1. A member proposes a song, audio segment, sermon, testimony, announcement, or program within an authorized church/project room.
2. A compatible AI assistant can help draft lyrics, prompts, scripts, show notes, metadata, schedules, and production tasks. **Suno MCP** is a candidate for music generation through a member's authorized Suno account; other generators and human-made recordings should remain welcome.
3. Authorized people review and approve the output, contributor credits, station fit, appropriate content ratings, and distribution rights. AI generation never automatically authorizes publication.
4. Approved media and provenance metadata may be stored in **Cloudflare R2** (or interoperable storage). R2 stores and serves media objects; it is **not** itself the scheduling or continuous-broadcast engine.
5. A separate radio automation/playout system builds the station schedule, produces the listening stream or synchronized playback, and keeps the station operating independently of any participant's computer.
6. Stations may explicitly submit approved tracks or programs to the wider federation for discovery, exchange, syndicated segments, shared playlists, or a separate curated network channel.

**Example:** Real Life Church creates a song with Suno, a musician adds a live performance, and an editor approves it. The approved audio enters its own station's library. The church then opts to share it with the federation; another church requests permission to include it in a joint reconciliation program. The common channel documents who approved what and where the media aired.

### Local stations remain sovereign

- Each station controls its own publishing rules, editorial responsibility, archives, schedule, and visibility.
- Sharing an item in the broader federation is opt-in and reversible for future programming; removal of cached or previously distributed copies requires a defined takedown process.
- Projects can recommend programs to other stations, but cannot force another station to carry them.
- Listeners can browse local stations, thematic collections, shared special events, or a continuously programmed federation channel.
- Creators and participating churches retain attributable credit and the rights they actually hold.

### Cross-station reasoning and moderation

An AI-assisted layer may detect overlaps in themes, Scripture references, musical genres, community needs, causes, event calendars, geographic interests, and collaboration opportunities. It can recommend co-productions, complementary scheduling, and cross-promotion.

**Editorial safeguards:**

- AI-generated classifications and ideological/theological tags are tentative, explainable, and editable by human curators, not pronouncements on a church's orthodoxy.
- Human stewards make consequential moderation and syndication decisions; appeals and corrections are possible.
- Distinguish harmful or impermissible material from legitimate doctrinal and cultural disagreements. The network should not silently impose one theology on independent churches.
- Moderation is scoped to local stations and the shared federation, with explicit roles; a federation decision does not rewrite a church's private library.
- Shared recommendations must not use unauthorized private conversation, pastoral records, or sensitive participant profiles.
- Log source, model suggestions, human approvals, decisions, and publication provenance.

### Technical candidates and boundaries

- **fellowSHIP rooms + permissions:** identity, invitations, governance, project data, collaboration events.
- **MCP and web clients:** optional ways for individual people and assistants to take authorized actions, never shared credentials.
- **Suno:** candidate music-creation integration; its capabilities, account entitlements, terms, and rights must be verified at integration time.
- **R2:** durable media object storage and CDN-facing delivery with proper access controls and cache management.
- **Station automation:** schedules, playlists, queueing, encoding/HLS or other streaming, station continuity, preloading, and resilience during contributor downtime. Existing HUMKIN radio work is a potential reference, not a dependency assumed to be production-ready.
- **Federation layer:** explicit syndication grants, station/feed metadata, discovery indexes, collaborative program proposals, programming lineage, permission-aware recommendations and takedowns.

### Rights and safety gates

Commercial-use grants and ownership of AI-generated music are not identical to proof that every element is cleared for public broadcasting. Before syndication, check the terms and provenance of each recording (including plan at generation, original and sampled material, performances, covers, voices, minors' consent, and any applicable music performance, sound-recording, or broadcasting licenses). Free-plan Suno outputs should not be presumed eligible for commercial use; later subscription upgrades do not automatically retroactively license earlier outputs.

Maintain media-level rights metadata and review routes; no automatic public release from generation alone. Budget for moderation workload, storage, bandwidth, and scaling. Radio should remain available to churches that record entirely human-made music.

### Open research questions

- Which Suno MCP actions can we lawfully and reliably automate for individual participating accounts, including file retrieval?
- Which station model best fits local independence: real-time streams, synchronized scheduled files, or hybrid HLS/live fallback?
- What rights are required for public internet radio in each jurisdiction and for each kind of programming?
- Who can grant, limit, expire, and revoke cross-station syndication rights, and what happens to archives and caches afterward?
- How do station editors define themes and handle contested theological classifications without a central authority adjudicating belief?
- What is the minimal safe pilot: two stations, one approved track or program, one voluntary federation playlist, and an auditable permission record?

## Delivery posture

**Near term:** Prove shared projects, separate accounts, invitations, role boundaries, task updates, and reliable handoffs between humans and their assistants.

**Later optional experiment:** Pilot two opt-in church stations and one cross-station program after the shared-room permissions and media rights gates are ready.

**Long horizon:** A network of networks in which churches and other communities can share their capabilities, productions, and commitments without surrendering local governance.

---

*This is a living vision document. Exploratory sections should not be treated as accepted requirements, production claims, or automatic consent to publish content.*
