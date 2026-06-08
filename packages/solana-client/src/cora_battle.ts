/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/cora_battle.json`.
 */
export type CoraBattle = {
  "address": "Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic",
  "metadata": {
    "name": "coraBattle",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Ephemeral Rollup program for CORA Battle"
  },
  "instructions": [
    {
      "name": "activateSession",
      "docs": [
        "Activate the session after card registration is complete.",
        "Transitions WaitingCards → Active. Authority-only."
      ],
      "discriminator": [
        225,
        216,
        111,
        21,
        69,
        235,
        96,
        66
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "applyCardEffect",
      "docs": [
        "Apply a backend-authorized final card effect to ER battle state.",
        "The backend remains the source of truth for answer validation and",
        "private multiplier computation; ER only stores the final public effect."
      ],
      "discriminator": [
        183,
        143,
        101,
        151,
        167,
        55,
        194,
        21
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "registeredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              },
              {
                "kind": "account",
                "path": "registered_card.card_id",
                "account": "registeredCard"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "finalValue",
          "type": "u16"
        },
        {
          "name": "scoreDelta",
          "type": "u32"
        }
      ]
    },
    {
      "name": "applyDamage",
      "docs": [
        "Apply damage to the opponent of the attacker.",
        "Authority-only. Backend verifies the answer off-chain,",
        "then calls this to record damage on-chain."
      ],
      "discriminator": [
        229,
        25,
        73,
        188,
        250,
        95,
        187,
        141
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "registeredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              },
              {
                "kind": "account",
                "path": "registered_card.card_id",
                "account": "registeredCard"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "attacker",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "applyEffect",
      "docs": [
        "Apply a committed inline manifest slot to ER battle state."
      ],
      "discriminator": [
        104,
        156,
        1,
        245,
        232,
        226,
        23,
        200
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "slot",
          "type": "u8"
        },
        {
          "name": "actorIsA",
          "type": "bool"
        },
        {
          "name": "finalValue",
          "type": "u16"
        },
        {
          "name": "scoreDelta",
          "type": "u32"
        }
      ]
    },
    {
      "name": "cancelSession",
      "docs": [
        "Cancel an unresolved session with an explicit ER outcome reason."
      ],
      "discriminator": [
        57,
        207,
        155,
        166,
        136,
        32,
        99,
        116
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "u8"
        }
      ]
    },
    {
      "name": "closeSession",
      "docs": [
        "Close a terminal session account and reclaim rent SOL.",
        "Authority-only. Only Finished or Cancelled sessions."
      ],
      "discriminator": [
        68,
        114,
        178,
        140,
        222,
        38,
        248,
        211
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "commitBattleSession",
      "docs": [
        "Schedule a BattleSession state commit from ER back to Solana."
      ],
      "discriminator": [
        63,
        180,
        117,
        22,
        4,
        108,
        97,
        37
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "commitRegisteredCard",
      "docs": [
        "Schedule a RegisteredCard state commit from ER back to Solana."
      ],
      "discriminator": [
        6,
        161,
        25,
        234,
        133,
        174,
        127,
        77
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createSession",
      "docs": [
        "Create a new battle session for two players.",
        "The signer becomes the session authority (backend oracle)."
      ],
      "discriminator": [
        242,
        193,
        143,
        179,
        150,
        25,
        122,
        227
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerA"
        },
        {
          "name": "playerB"
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "questionHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "delegateBattleSession",
      "docs": [
        "Delegate the BattleSession PDA from the Solana base layer to MagicBlock ER."
      ],
      "discriminator": [
        246,
        129,
        186,
        190,
        203,
        16,
        146,
        18
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "bufferBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                39,
                72,
                184,
                233,
                248,
                135,
                5,
                202,
                198,
                87,
                118,
                52,
                152,
                206,
                248,
                128,
                229,
                220,
                144,
                70,
                231,
                66,
                242,
                194,
                253,
                167,
                96,
                80,
                195,
                46,
                177,
                187
              ]
            }
          }
        },
        {
          "name": "delegationRecordBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataBattleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "battleSession",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "delegateRegisteredCard",
      "docs": [
        "Delegate one RegisteredCard PDA so replay state can be mutated in ER."
      ],
      "discriminator": [
        128,
        61,
        132,
        99,
        66,
        67,
        175,
        81
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true
        },
        {
          "name": "bufferRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  117,
                  102,
                  102,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                39,
                72,
                184,
                233,
                248,
                135,
                5,
                202,
                198,
                87,
                118,
                52,
                152,
                206,
                248,
                128,
                229,
                220,
                144,
                70,
                231,
                66,
                242,
                194,
                253,
                167,
                96,
                80,
                195,
                46,
                177,
                187
              ]
            }
          }
        },
        {
          "name": "delegationRecordRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "delegationMetadataRegisteredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  101,
                  108,
                  101,
                  103,
                  97,
                  116,
                  105,
                  111,
                  110,
                  45,
                  109,
                  101,
                  116,
                  97,
                  100,
                  97,
                  116,
                  97
                ]
              },
              {
                "kind": "account",
                "path": "registeredCard"
              }
            ],
            "program": {
              "kind": "account",
              "path": "delegationProgram"
            }
          }
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "ownerProgram",
          "address": "Azn65FT27X2VpXHgLCXPCqjgWKEeveVzGqEvZcNp2Lic"
        },
        {
          "name": "delegationProgram",
          "address": "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "finalizeMatch",
      "docs": [
        "Emit the BattleFinalized event for the settlement oracle.",
        "Authority-only. Session must be in Finished status."
      ],
      "discriminator": [
        6,
        103,
        47,
        7,
        66,
        1,
        85,
        207
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "forceEnd",
      "docs": [
        "Force-end a timed-out session. Authority-only.",
        "Only callable after SESSION_TIMEOUT has elapsed."
      ],
      "discriminator": [
        182,
        253,
        37,
        77,
        135,
        204,
        99,
        160
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "processUndelegation",
      "discriminator": [
        196,
        28,
        41,
        206,
        48,
        37,
        51,
        167
      ],
      "accounts": [
        {
          "name": "baseAccount",
          "writable": true
        },
        {
          "name": "buffer"
        },
        {
          "name": "payer",
          "writable": true
        },
        {
          "name": "systemProgram"
        }
      ],
      "args": [
        {
          "name": "accountSeeds",
          "type": {
            "vec": "bytes"
          }
        }
      ]
    },
    {
      "name": "registerCard",
      "docs": [
        "Register a card (question mapping) for a battle session.",
        "Legacy damage-only path. New effect-aware flows should use register_card_v2."
      ],
      "discriminator": [
        33,
        25,
        154,
        111,
        155,
        31,
        45,
        36
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "damage",
          "type": "u16"
        }
      ]
    },
    {
      "name": "registerCardV2",
      "docs": [
        "Register an effect-aware card for ER resolution.",
        "Authority-only. Only allowed in WaitingCards status."
      ],
      "discriminator": [
        210,
        169,
        134,
        131,
        120,
        191,
        221,
        138
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  97,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "battleSession"
              },
              {
                "kind": "arg",
                "path": "cardId"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cardId",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "owner",
          "type": "pubkey"
        },
        {
          "name": "effectType",
          "type": "u8"
        },
        {
          "name": "maxValue",
          "type": "u16"
        }
      ]
    },
    {
      "name": "resolveRoundByState",
      "docs": [
        "Resolve a timer-expired round from current ER state.",
        "Uses only public state: health, round damage, and existing match totals."
      ],
      "discriminator": [
        68,
        216,
        6,
        37,
        4,
        246,
        43,
        183
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "setCardManifest",
      "docs": [
        "Commit the immutable inline manifest for one player before activation."
      ],
      "discriminator": [
        83,
        230,
        211,
        159,
        26,
        197,
        227,
        89
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "isPlayerA",
          "type": "bool"
        },
        {
          "name": "totalSlots",
          "type": "u8"
        },
        {
          "name": "manifest",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "surrenderMatch",
      "docs": [
        "Finish the match immediately when one player surrenders."
      ],
      "discriminator": [
        88,
        192,
        115,
        167,
        225,
        234,
        64,
        124
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "surrenderingPlayer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "timeoutPlayerForRound",
      "docs": [
        "Resolve a single-player round timeout after the round deadline.",
        "Reconnects before this deadline are handled off-chain by the backend."
      ],
      "discriminator": [
        252,
        81,
        161,
        108,
        203,
        35,
        169,
        82
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "timedOutPlayer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "undelegateBattleSession",
      "docs": [
        "Commit and undelegate the BattleSession PDA when the battle has ended."
      ],
      "discriminator": [
        15,
        152,
        195,
        62,
        218,
        157,
        220,
        114
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  116,
                  116,
                  108,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "battle_session.match_id",
                "account": "battleSession"
              }
            ]
          }
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "undelegateRegisteredCard",
      "docs": [
        "Commit and undelegate a RegisteredCard PDA when the battle has ended."
      ],
      "discriminator": [
        102,
        60,
        153,
        72,
        76,
        24,
        24,
        96
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "battleSession"
        },
        {
          "name": "registeredCard",
          "writable": true
        },
        {
          "name": "magicProgram",
          "address": "Magic11111111111111111111111111111111111111"
        },
        {
          "name": "magicContext",
          "writable": true,
          "address": "MagicContext1111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "battleSession",
      "discriminator": [
        254,
        114,
        29,
        174,
        211,
        191,
        25,
        241
      ]
    },
    {
      "name": "registeredCard",
      "discriminator": [
        148,
        137,
        2,
        150,
        69,
        216,
        200,
        18
      ]
    }
  ],
  "events": [
    {
      "name": "battleFinalizedEvent",
      "discriminator": [
        142,
        217,
        149,
        240,
        232,
        110,
        81,
        78
      ]
    },
    {
      "name": "cardEffectAppliedEvent",
      "discriminator": [
        247,
        16,
        82,
        16,
        174,
        134,
        108,
        63
      ]
    },
    {
      "name": "cardRegisteredEvent",
      "discriminator": [
        0,
        83,
        86,
        238,
        44,
        94,
        148,
        156
      ]
    },
    {
      "name": "damageAppliedEvent",
      "discriminator": [
        159,
        137,
        92,
        244,
        19,
        105,
        85,
        91
      ]
    },
    {
      "name": "effectAppliedEvent",
      "discriminator": [
        31,
        240,
        31,
        214,
        244,
        176,
        6,
        217
      ]
    },
    {
      "name": "manifestCommittedEvent",
      "discriminator": [
        132,
        141,
        166,
        237,
        92,
        105,
        3,
        201
      ]
    },
    {
      "name": "matchSurrenderedEvent",
      "discriminator": [
        6,
        76,
        143,
        219,
        7,
        214,
        63,
        110
      ]
    },
    {
      "name": "roundAdvancedEvent",
      "discriminator": [
        68,
        10,
        218,
        225,
        156,
        83,
        179,
        174
      ]
    },
    {
      "name": "roundEndedEvent",
      "discriminator": [
        225,
        93,
        137,
        158,
        12,
        107,
        81,
        122
      ]
    },
    {
      "name": "roundResolvedByStateEvent",
      "discriminator": [
        164,
        35,
        224,
        170,
        255,
        193,
        73,
        70
      ]
    },
    {
      "name": "roundTimedOutEvent",
      "discriminator": [
        173,
        100,
        219,
        75,
        250,
        125,
        235,
        153
      ]
    },
    {
      "name": "sessionActivatedEvent",
      "discriminator": [
        58,
        171,
        147,
        8,
        109,
        155,
        244,
        242
      ]
    },
    {
      "name": "sessionCancelledEvent",
      "discriminator": [
        172,
        115,
        8,
        217,
        141,
        247,
        142,
        175
      ]
    },
    {
      "name": "sessionCreatedEvent",
      "discriminator": [
        35,
        41,
        98,
        73,
        187,
        32,
        19,
        12
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidStatus",
      "msg": "Session is not in the expected status"
    },
    {
      "code": 6001,
      "name": "unauthorizedPlayer",
      "msg": "Player is not a participant in this session"
    },
    {
      "code": 6002,
      "name": "unregisteredCard",
      "msg": "Card does not belong to this session"
    },
    {
      "code": 6003,
      "name": "unauthorizedAuthority",
      "msg": "Only the session authority can perform this action"
    },
    {
      "code": 6004,
      "name": "alreadyFinished",
      "msg": "Session has already finished"
    },
    {
      "code": 6005,
      "name": "samePlayer",
      "msg": "Player A and Player B cannot be the same address"
    },
    {
      "code": 6006,
      "name": "cardAlreadyUsed",
      "msg": "Card has already been used in this session"
    },
    {
      "code": 6007,
      "name": "invalidDamage",
      "msg": "Damage value is out of allowed range"
    },
    {
      "code": 6008,
      "name": "invalidEffectType",
      "msg": "Effect type is not valid for this card"
    },
    {
      "code": 6009,
      "name": "invalidEffectValue",
      "msg": "Effect value is not valid for this card"
    },
    {
      "code": 6010,
      "name": "invalidScoreDelta",
      "msg": "Gameplay score delta is out of allowed range"
    },
    {
      "code": 6011,
      "name": "invalidCardOwner",
      "msg": "Registered card owner is not valid for this session"
    },
    {
      "code": 6012,
      "name": "invalidRoundState",
      "msg": "Current round state is not valid for this instruction"
    },
    {
      "code": 6013,
      "name": "invalidTarget",
      "msg": "Target must be a participant in this session"
    },
    {
      "code": 6014,
      "name": "timeoutNotReached",
      "msg": "Session timeout has not been reached yet"
    },
    {
      "code": 6015,
      "name": "roundDeadlinePassed",
      "msg": "Round deadline has passed for applying card effects"
    },
    {
      "code": 6016,
      "name": "invalidEndReason",
      "msg": "End reason is not valid for this instruction"
    },
    {
      "code": 6017,
      "name": "sessionExpired",
      "msg": "Session has expired due to timeout"
    },
    {
      "code": 6018,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow in game state calculation"
    },
    {
      "code": 6019,
      "name": "manifestNotCommitted",
      "msg": "Card manifest has not been committed yet"
    },
    {
      "code": 6020,
      "name": "invalidManifest",
      "msg": "Card manifest data is invalid"
    },
    {
      "code": 6021,
      "name": "slotOutOfBounds",
      "msg": "Card slot index is out of bounds"
    },
    {
      "code": 6022,
      "name": "scoreDeltaExceedsMultiplier",
      "msg": "Score delta exceeds multiplier-based maximum"
    },
    {
      "code": 6023,
      "name": "invalidSurrenderPlayer",
      "msg": "Surrendering player is invalid"
    }
  ],
  "types": [
    {
      "name": "battleFinalizedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "endReason",
            "type": "u8"
          },
          {
            "name": "scoreA",
            "docs": [
              "Canonical round wins for player A."
            ],
            "type": "u16"
          },
          {
            "name": "scoreB",
            "docs": [
              "Canonical round wins for player B."
            ],
            "type": "u16"
          },
          {
            "name": "roundsWonA",
            "docs": [
              "Legacy duplicate of score_a, kept for compatibility."
            ],
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "docs": [
              "Legacy duplicate of score_b, kept for compatibility."
            ],
            "type": "u8"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "gameScoreA",
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "battleSession",
      "docs": [
        "The main battle session account, tracking all on-chain game state.",
        "Acts as a backend-authorized battle state mirror. Answer verification and",
        "private effect math stay off-chain; ER only records final public effects."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "version",
            "docs": [
              "Schema version for forward-compatible upgrades"
            ],
            "type": "u8"
          },
          {
            "name": "matchId",
            "docs": [
              "Unique match identifier (sha256 of match UUID from backend)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "docs": [
              "The backend oracle authority that controls this session.",
              "Only this signer can register cards, apply damage, and finalize."
            ],
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "docs": [
              "Player A's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "docs": [
              "Player B's wallet address"
            ],
            "type": "pubkey"
          },
          {
            "name": "healthA",
            "docs": [
              "Player A's current health points (reset each round)"
            ],
            "type": "u16"
          },
          {
            "name": "healthB",
            "docs": [
              "Player B's current health points (reset each round)"
            ],
            "type": "u16"
          },
          {
            "name": "scoreA",
            "docs": [
              "Canonical rounds won by player A for match winner evaluation."
            ],
            "type": "u16"
          },
          {
            "name": "scoreB",
            "docs": [
              "Canonical rounds won by player B for match winner evaluation."
            ],
            "type": "u16"
          },
          {
            "name": "currentRound",
            "docs": [
              "Current round number (1-indexed while active, 0 before activation)"
            ],
            "type": "u8"
          },
          {
            "name": "roundsWonA",
            "docs": [
              "Legacy duplicate of score_a, kept synchronized for backward compatibility."
            ],
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "docs": [
              "Legacy duplicate of score_b, kept synchronized for backward compatibility."
            ],
            "type": "u8"
          },
          {
            "name": "roundStartedAt",
            "docs": [
              "Unix timestamp when the current round started"
            ],
            "type": "i64"
          },
          {
            "name": "roundDeadline",
            "docs": [
              "Unix timestamp when the current round may be resolved by timeout"
            ],
            "type": "i64"
          },
          {
            "name": "playerAMissedRounds",
            "docs": [
              "Rounds missed by player A due to timeout"
            ],
            "type": "u8"
          },
          {
            "name": "playerBMissedRounds",
            "docs": [
              "Rounds missed by player B due to timeout"
            ],
            "type": "u8"
          },
          {
            "name": "totalPlays",
            "docs": [
              "Total resolved card plays applied to ER state (audit trail)"
            ],
            "type": "u16"
          },
          {
            "name": "status",
            "docs": [
              "Current battle status (state machine)"
            ],
            "type": {
              "defined": {
                "name": "battleStatus"
              }
            }
          },
          {
            "name": "winner",
            "docs": [
              "Winner's pubkey (Pubkey::default() until Finished)"
            ],
            "type": "pubkey"
          },
          {
            "name": "questionHash",
            "docs": [
              "SHA-256 hash of the public question set commitment, not an answer hash."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when session was created"
            ],
            "type": "i64"
          },
          {
            "name": "finishedAt",
            "docs": [
              "Unix timestamp when session finished (0 if not finished)"
            ],
            "type": "i64"
          },
          {
            "name": "endReason",
            "docs": [
              "Terminal outcome reason. See END_REASON_* constants."
            ],
            "type": "u8"
          },
          {
            "name": "gameScoreA",
            "docs": [
              "Cumulative gameplay score for player A, used for final tie-breaks."
            ],
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "docs": [
              "Cumulative gameplay score for player B, used for final tie-breaks."
            ],
            "type": "u32"
          },
          {
            "name": "roundDamageA",
            "docs": [
              "Attack damage contributed by player A during the current round."
            ],
            "type": "u32"
          },
          {
            "name": "roundDamageB",
            "docs": [
              "Attack damage contributed by player B during the current round."
            ],
            "type": "u32"
          },
          {
            "name": "totalSlotsA",
            "docs": [
              "Total inline manifest slots committed for player A."
            ],
            "type": "u8"
          },
          {
            "name": "totalSlotsB",
            "docs": [
              "Total inline manifest slots committed for player B."
            ],
            "type": "u8"
          },
          {
            "name": "cardsUsedA",
            "docs": [
              "Replay bitmask for player A card slots."
            ],
            "type": "u128"
          },
          {
            "name": "cardsUsedB",
            "docs": [
              "Replay bitmask for player B card slots."
            ],
            "type": "u128"
          },
          {
            "name": "manifestCommittedA",
            "docs": [
              "Whether player A's manifest has been committed."
            ],
            "type": "bool"
          },
          {
            "name": "manifestCommittedB",
            "docs": [
              "Whether player B's manifest has been committed."
            ],
            "type": "bool"
          },
          {
            "name": "cardManifestA",
            "docs": [
              "Packed inline manifest for player A."
            ],
            "type": {
              "array": [
                "u8",
                384
              ]
            }
          },
          {
            "name": "cardManifestB",
            "docs": [
              "Packed inline manifest for player B."
            ],
            "type": {
              "array": [
                "u8",
                384
              ]
            }
          }
        ]
      }
    },
    {
      "name": "battleStatus",
      "docs": [
        "State machine for battle lifecycle.",
        "Transitions: WaitingCards → Active → Finished",
        "→ Cancelled (via force_end)",
        "WaitingCards → Cancelled (via force_end)"
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingCards"
          },
          {
            "name": "active"
          },
          {
            "name": "finished"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "cardEffectAppliedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "card",
            "type": "pubkey"
          },
          {
            "name": "actor",
            "type": "pubkey"
          },
          {
            "name": "effectType",
            "type": "u8"
          },
          {
            "name": "finalValue",
            "type": "u16"
          },
          {
            "name": "scoreDelta",
            "type": "u32"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "scoreA",
            "type": "u16"
          },
          {
            "name": "scoreB",
            "type": "u16"
          },
          {
            "name": "gameScoreA",
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "type": "u32"
          },
          {
            "name": "currentRound",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "cardRegisteredEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "card",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "cardId",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "effectType",
            "type": "u8"
          },
          {
            "name": "maxValue",
            "type": "u16"
          },
          {
            "name": "damage",
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "damageAppliedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "attacker",
            "type": "pubkey"
          },
          {
            "name": "damage",
            "type": "u16"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "round",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "effectAppliedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "actor",
            "type": "pubkey"
          },
          {
            "name": "actorIsA",
            "type": "bool"
          },
          {
            "name": "slot",
            "type": "u8"
          },
          {
            "name": "effectType",
            "type": "u8"
          },
          {
            "name": "maxValue",
            "type": "u16"
          },
          {
            "name": "finalValue",
            "type": "u16"
          },
          {
            "name": "scoreDelta",
            "type": "u32"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "scoreA",
            "type": "u16"
          },
          {
            "name": "scoreB",
            "type": "u16"
          },
          {
            "name": "gameScoreA",
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "type": "u32"
          },
          {
            "name": "currentRound",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "manifestCommittedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isPlayerA",
            "type": "bool"
          },
          {
            "name": "totalSlots",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "matchSurrenderedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "surrenderingPlayer",
            "type": "pubkey"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "currentRound",
            "type": "u8"
          },
          {
            "name": "scoreA",
            "type": "u16"
          },
          {
            "name": "scoreB",
            "type": "u16"
          },
          {
            "name": "gameScoreA",
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "type": "u32"
          },
          {
            "name": "finishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "registeredCard",
      "docs": [
        "A registered card representing one question's public ER effect envelope.",
        "The card_id uses dummy ephemeral IDs to prevent correlation with",
        "real question IDs in the database (privacy via Ephemeral Mapping)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "docs": [
              "Reference to parent BattleSession PDA"
            ],
            "type": "pubkey"
          },
          {
            "name": "cardId",
            "docs": [
              "Dummy card identifier for ephemeral mapping"
            ],
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "owner",
            "docs": [
              "Player who is allowed to resolve this card in ER."
            ],
            "type": "pubkey"
          },
          {
            "name": "effectType",
            "docs": [
              "Public effect kind used for auditable ER state changes."
            ],
            "type": "u8"
          },
          {
            "name": "maxValue",
            "docs": [
              "Maximum final effect value the backend may authorize for this card."
            ],
            "type": "u16"
          },
          {
            "name": "damage",
            "docs": [
              "Legacy damage-only attack value used by apply_damage compatibility flow."
            ],
            "type": "u16"
          },
          {
            "name": "isUsed",
            "docs": [
              "Replay protection — card can only be used once"
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roundAdvancedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "currentRound",
            "type": "u8"
          },
          {
            "name": "roundDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "roundEndedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "roundWinner",
            "type": "pubkey"
          },
          {
            "name": "roundsWonA",
            "type": "u8"
          },
          {
            "name": "roundsWonB",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "roundResolvedByStateEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "round",
            "type": "u8"
          },
          {
            "name": "resolver",
            "type": "pubkey"
          },
          {
            "name": "healthA",
            "type": "u16"
          },
          {
            "name": "healthB",
            "type": "u16"
          },
          {
            "name": "roundDamageA",
            "type": "u32"
          },
          {
            "name": "roundDamageB",
            "type": "u32"
          },
          {
            "name": "roundWinner",
            "type": "pubkey"
          },
          {
            "name": "scoreA",
            "type": "u16"
          },
          {
            "name": "scoreB",
            "type": "u16"
          },
          {
            "name": "gameScoreA",
            "type": "u32"
          },
          {
            "name": "gameScoreB",
            "type": "u32"
          },
          {
            "name": "nextRound",
            "type": "u8"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "wasDraw",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "roundTimedOutEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timedOutPlayer",
            "type": "pubkey"
          },
          {
            "name": "roundWinner",
            "type": "pubkey"
          },
          {
            "name": "currentRound",
            "type": "u8"
          },
          {
            "name": "scoreA",
            "docs": [
              "Canonical round wins for player A."
            ],
            "type": "u16"
          },
          {
            "name": "scoreB",
            "docs": [
              "Canonical round wins for player B."
            ],
            "type": "u16"
          }
        ]
      }
    },
    {
      "name": "sessionActivatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "currentRound",
            "type": "u8"
          },
          {
            "name": "roundDeadline",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sessionCancelledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "session",
            "type": "pubkey"
          },
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reason",
            "type": "u8"
          },
          {
            "name": "finishedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "sessionCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "playerA",
            "type": "pubkey"
          },
          {
            "name": "playerB",
            "type": "pubkey"
          },
          {
            "name": "questionHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
