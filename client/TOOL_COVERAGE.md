# Hermes Board Client Skill Coverage

This matrix maps the release MCP tool surface to the client workflow that owns it.

| MCP tool | Client workflow |
|----------|-----------------|
| `hb_list_boards` | `hb-monitor`, install verification |
| `hb_health` | install verification, `hb-monitor` |
| `hb_create_board` | `hb-plan` |
| `hb_list_tasks` | `hb-monitor`, `hb-release` |
| `hb_show_task` | `hb-monitor`, `hb-worker`, `hb-release` |
| `hb_create_task` | `hb-plan` |
| `hb_assign_task` | `hb-plan` |
| `hb_complete_task` | `hb-worker`, `hb-release` |
| `hb_block_task` | `hb-plan`, `hb-worker` |
| `hb_unblock_task` | `hb-plan`, `hb-worker` |
| `hb_archive_task` | `hb-release` |
| `hb_add_comment` | `hb-plan`, `hb-worker` |
| `hb_link_tasks` | `hb-plan` |
| `hb_unlink_tasks` | `hb-plan` |
| `hb_specify_task` | `hb-plan` |
| `hb_dispatch_tasks` | `hb-plan` |
| `hb_get_runs` | `hb-monitor`, `hb-release` |
| `hb_get_stats` | `hb-monitor`, `hb-release` |
| `hb_tail_events` | `hb-monitor` |
| `hb_send_heartbeat` | `hb-worker` |
| `hb_import_spec` | `hb-deploy` |

Release verification checks this package with `npm pack --dry-run` and ensures the canonical skill set ships without stale skill directories.
