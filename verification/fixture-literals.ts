import type { FixtureChecks } from "./typecheck-fixtures";
export const checkedFixtures = {
  "catalog": {
    "ok": true,
    "data": {
      "config": {
        "modelVersion": "demo-v1",
        "budgetLimit": 100,
        "decisionsRequired": 5,
        "horizonMonths": 12,
        "lagRule": "step",
        "dimensionWeights": {
          "transport": 0.2,
          "green": 0.2,
          "social": 0.2,
          "safety": 0.2,
          "services": 0.2
        },
        "dataMode": "synthetic",
        "disclaimer": "Демонстрационная модель: синтетические данные и условные районы D1–D3. Не официальная статистика, не административное деление и не прогноз Астаны."
      },
      "districts": [
        {
          "id": "D1",
          "name": "Демо-район Север",
          "weight": 0.3333333333333333,
          "baseline": {
            "transport": 45,
            "green": 42,
            "social": 46,
            "safety": 44,
            "services": 48
          }
        },
        {
          "id": "D2",
          "name": "Демо-район Центр",
          "weight": 0.3333333333333333,
          "baseline": {
            "transport": 58,
            "green": 50,
            "social": 55,
            "safety": 52,
            "services": 55
          }
        },
        {
          "id": "D3",
          "name": "Демо-район Юг",
          "weight": 0.3333333333333333,
          "baseline": {
            "transport": 40,
            "green": 38,
            "social": 42,
            "safety": 41,
            "services": 43
          }
        }
      ],
      "actions": [
        {
          "id": "bus_lanes",
          "title": "Выделенные автобусные полосы",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "transport",
          "cost": 18,
          "lagMonths": 2,
          "effects": {
            "D1": {
              "transport": 16,
              "green": -2
            },
            "D2": {
              "transport": 10,
              "green": -1
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "bus_fleet",
          "title": "Обновление автобусного парка",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "transport",
          "cost": 24,
          "lagMonths": 4,
          "effects": {
            "D1": {
              "transport": 10,
              "green": 3
            },
            "D3": {
              "transport": 12,
              "green": 3
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "traffic_signals",
          "title": "Настройка светофоров",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "transport",
          "cost": 14,
          "lagMonths": 1,
          "effects": {
            "D1": {
              "transport": 8,
              "safety": 3
            },
            "D2": {
              "transport": 8,
              "safety": 3
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "park_local",
          "title": "Озеленение общественных пространств",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "green",
          "cost": 16,
          "lagMonths": 3,
          "effects": {
            "D1": {
              "green": 18,
              "safety": 3
            },
            "D3": {
              "green": 12
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "tree_belts",
          "title": "Защитные зеленые полосы",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "green",
          "cost": 20,
          "lagMonths": 6,
          "effects": {
            "D1": {
              "green": 12
            },
            "D2": {
              "green": 8
            },
            "D3": {
              "green": 7
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "green_longterm",
          "title": "Долгосрочный городской лес",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "green",
          "cost": 18,
          "lagMonths": 18,
          "effects": {
            "D1": {
              "green": 25
            },
            "D3": {
              "green": 25
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "school_new",
          "title": "Строительство школы",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "social",
          "cost": 30,
          "lagMonths": 6,
          "effects": {
            "D3": {
              "social": 24,
              "services": 4
            },
            "D2": {
              "social": 6
            }
          },
          "constraints": {
            "requires": [],
            "excludes": [
              "school_modular"
            ]
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "school_modular",
          "title": "Модульные учебные корпуса",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "social",
          "cost": 36,
          "lagMonths": 3,
          "effects": {
            "D3": {
              "social": 22,
              "services": 3
            },
            "D2": {
              "social": 3
            }
          },
          "constraints": {
            "requires": [],
            "excludes": [
              "school_new"
            ]
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "classes_rental",
          "title": "Аренда помещений под учебные классы",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "social",
          "cost": 22,
          "lagMonths": 0,
          "effects": {
            "D3": {
              "social": 17,
              "services": 2
            },
            "D2": {
              "social": 2
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "clinic_outreach",
          "title": "Выездные медицинские бригады",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "social",
          "cost": 20,
          "lagMonths": 1,
          "effects": {
            "D3": {
              "social": 13
            },
            "D1": {
              "social": 7,
              "services": 4
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "lighting_smart",
          "title": "Освещение безопасных маршрутов",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "safety",
          "cost": 12,
          "lagMonths": 1,
          "effects": {
            "D3": {
              "safety": 18,
              "services": 2
            },
            "D1": {
              "safety": 8,
              "green": -1
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "safe_crossings",
          "title": "Безопасные пешеходные переходы",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "safety",
          "cost": 10,
          "lagMonths": 1,
          "effects": {
            "D1": {
              "safety": 10,
              "transport": -2
            },
            "D3": {
              "safety": 12
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "safety_sensors",
          "title": "Датчики состояния освещения",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "safety",
          "cost": 8,
          "lagMonths": 2,
          "effects": {
            "D1": {
              "safety": 5
            },
            "D3": {
              "safety": 7
            }
          },
          "constraints": {
            "requires": [
              "lighting_smart"
            ],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "services_online",
          "title": "Городские услуги онлайн",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "services",
          "cost": 14,
          "lagMonths": 1,
          "effects": {
            "D1": {
              "services": 15
            },
            "D2": {
              "services": 12
            },
            "D3": {
              "services": 10,
              "social": 2
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "service_centers",
          "title": "Мобильные центры обслуживания",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "services",
          "cost": 18,
          "lagMonths": 2,
          "effects": {
            "D1": {
              "services": 10
            },
            "D2": {
              "services": 5
            },
            "D3": {
              "services": 12
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "always"
          }
        },
        {
          "id": "digital_grant",
          "title": "Грантовая программа цифровых услуг",
          "description": "Синтетическое мероприятие учебной модели; эффекты не являются прогнозом реального города.",
          "direction": "services",
          "cost": 8,
          "lagMonths": 0,
          "effects": {
            "D1": {
              "services": 15
            },
            "D2": {
              "services": 15
            },
            "D3": {
              "services": 15,
              "social": 3
            }
          },
          "constraints": {
            "requires": [],
            "excludes": []
          },
          "availability": {
            "kind": "event",
            "eventId": "digital_grant_available"
          }
        }
      ],
      "events": [
        {
          "id": "school_site_unavailable",
          "title": "Строительство школы отменено: участок недоступен",
          "description": "Учебный сценарий: план еще не исполнен; вся стоимость школы возвращается в бюджет ветки.",
          "kind": "cancellation",
          "blockedActionId": "school_new"
        },
        {
          "id": "digital_grant_available",
          "title": "Открылась грантовая программа цифровых услуг",
          "description": "Предварительно описанный проект стал доступен. Он должен заменить одно из пяти мероприятий.",
          "kind": "opportunity",
          "unlockedActionId": "digital_grant"
        }
      ],
      "demoPlan": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "school_new",
          "park_local",
          "lighting_smart",
          "services_online"
        ]
      }
    }
  },
  "valid": {
    "ok": true,
    "data": {
      "plan": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "lighting_smart",
          "park_local",
          "school_new",
          "services_online"
        ]
      },
      "totalCost": 90,
      "remainingBudget": 10,
      "warnings": [],
      "valid": true,
      "officialScore": 57.0,
      "errors": [],
      "metrics": {
        "dimensions": {
          "transport": 56.33333333333333,
          "green": 51.99999999999999,
          "social": 58.33333333333333,
          "safety": 55.33333333333333,
          "services": 62.99999999999999
        },
        "districts": [
          {
            "districtId": "D1",
            "before": {
              "transport": 45,
              "green": 42,
              "social": 46,
              "safety": 44,
              "services": 48
            },
            "after": {
              "transport": 61,
              "green": 57,
              "social": 46,
              "safety": 55,
              "services": 63
            },
            "scoreBefore": 45.0,
            "scoreAfter": 56.400000000000006,
            "scoreDelta": 11.400000000000006
          },
          {
            "districtId": "D2",
            "before": {
              "transport": 58,
              "green": 50,
              "social": 55,
              "safety": 52,
              "services": 55
            },
            "after": {
              "transport": 68,
              "green": 49,
              "social": 61,
              "safety": 52,
              "services": 67
            },
            "scoreBefore": 54.0,
            "scoreAfter": 59.400000000000006,
            "scoreDelta": 5.400000000000006
          },
          {
            "districtId": "D3",
            "before": {
              "transport": 40,
              "green": 38,
              "social": 42,
              "safety": 41,
              "services": 43
            },
            "after": {
              "transport": 40,
              "green": 50,
              "social": 68,
              "safety": 59,
              "services": 59
            },
            "scoreBefore": 40.800000000000004,
            "scoreAfter": 55.2,
            "scoreDelta": 14.399999999999999
          }
        ],
        "baselineOfficialScore": 46.6,
        "deltaFromBaseline": 10.399999999999999
      },
      "trace": [
        {
          "actionId": "bus_lanes",
          "active": true,
          "lagMonths": 2,
          "appliedEffects": {
            "D1": {
              "transport": 16,
              "green": -2
            },
            "D2": {
              "transport": 10,
              "green": -1
            }
          }
        },
        {
          "actionId": "lighting_smart",
          "active": true,
          "lagMonths": 1,
          "appliedEffects": {
            "D3": {
              "safety": 18,
              "services": 2
            },
            "D1": {
              "safety": 8,
              "green": -1
            }
          }
        },
        {
          "actionId": "park_local",
          "active": true,
          "lagMonths": 3,
          "appliedEffects": {
            "D1": {
              "green": 18,
              "safety": 3
            },
            "D3": {
              "green": 12
            }
          }
        },
        {
          "actionId": "school_new",
          "active": true,
          "lagMonths": 6,
          "appliedEffects": {
            "D3": {
              "social": 24,
              "services": 4
            },
            "D2": {
              "social": 6
            }
          }
        },
        {
          "actionId": "services_online",
          "active": true,
          "lagMonths": 1,
          "appliedEffects": {
            "D1": {
              "services": 15
            },
            "D2": {
              "services": 12
            },
            "D3": {
              "services": 10,
              "social": 2
            }
          }
        }
      ]
    }
  },
  "invalidFour": {
    "ok": true,
    "data": {
      "plan": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "lighting_smart",
          "park_local",
          "services_online"
        ]
      },
      "totalCost": 60,
      "remainingBudget": 40,
      "warnings": [],
      "valid": false,
      "officialScore": null,
      "errors": [
        {
          "code": "DECISION_COUNT",
          "message": "Нужно выбрать ровно пять мероприятий.",
          "actionIds": []
        }
      ],
      "metrics": null,
      "trace": []
    }
  },
  "invalidSix": {
    "ok": true,
    "data": {
      "plan": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "lighting_smart",
          "park_local",
          "safe_crossings",
          "school_new",
          "services_online"
        ]
      },
      "totalCost": 100,
      "remainingBudget": 0,
      "warnings": [],
      "valid": false,
      "officialScore": null,
      "errors": [
        {
          "code": "DECISION_COUNT",
          "message": "Нужно выбрать ровно пять мероприятий.",
          "actionIds": []
        }
      ],
      "metrics": null,
      "trace": []
    }
  },
  "eventPreview": {
    "ok": true,
    "data": {
      "base": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 90,
        "remainingBudget": 10,
        "warnings": [],
        "valid": true,
        "officialScore": 57.0,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 58.33333333333333,
            "safety": 55.33333333333333,
            "services": 62.99999999999999
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 61,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 59.400000000000006,
              "scoreDelta": 5.400000000000006
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 68,
                "safety": 59,
                "services": 59
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 55.2,
              "scoreDelta": 14.399999999999999
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.399999999999999
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "event": {
        "id": "school_site_unavailable",
        "title": "Строительство школы отменено: участок недоступен",
        "description": "Учебный сценарий: план еще не исполнен; вся стоимость школы возвращается в бюджет ветки.",
        "kind": "cancellation",
        "blockedActionId": "school_new"
      },
      "draft": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "lighting_smart",
          "park_local",
          "services_online"
        ]
      },
      "draftResult": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "services_online"
          ]
        },
        "totalCost": 60,
        "remainingBudget": 40,
        "warnings": [],
        "valid": false,
        "officialScore": null,
        "errors": [
          {
            "code": "DECISION_COUNT",
            "message": "Нужно выбрать ровно пять мероприятий.",
            "actionIds": []
          }
        ],
        "metrics": null,
        "trace": []
      },
      "requiresReplacement": true,
      "replacementOptions": [
        {
          "removedActionId": "school_new",
          "addedActionId": "bus_fleet",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "bus_fleet",
              "bus_lanes",
              "lighting_smart",
              "park_local",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "bus_fleet",
                "bus_lanes",
                "lighting_smart",
                "park_local",
                "services_online"
              ]
            },
            "totalCost": 84,
            "remainingBudget": 16,
            "warnings": [],
            "valid": true,
            "officialScore": 56.599999999999994,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 63.66666666666666,
                "green": 53.99999999999999,
                "social": 48.33333333333333,
                "safety": 55.33333333333333,
                "services": 61.66666666666666
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 71,
                    "green": 60,
                    "social": 46,
                    "safety": 55,
                    "services": 63
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 59.0,
                  "scoreDelta": 14.0
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 68,
                    "green": 49,
                    "social": 55,
                    "safety": 52,
                    "services": 67
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 58.2,
                  "scoreDelta": 4.200000000000003
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 52,
                    "green": 53,
                    "social": 44,
                    "safety": 59,
                    "services": 55
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 52.6,
                  "scoreDelta": 11.799999999999997
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 9.999999999999993
            },
            "trace": [
              {
                "actionId": "bus_fleet",
                "active": true,
                "lagMonths": 4,
                "appliedEffects": {
                  "D1": {
                    "transport": 10,
                    "green": 3
                  },
                  "D3": {
                    "transport": 12,
                    "green": 3
                  }
                }
              },
              {
                "actionId": "bus_lanes",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "transport": 16,
                    "green": -2
                  },
                  "D2": {
                    "transport": 10,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "lighting_smart",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D3": {
                    "safety": 18,
                    "services": 2
                  },
                  "D1": {
                    "safety": 8,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "park_local",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D1": {
                    "green": 18,
                    "safety": 3
                  },
                  "D3": {
                    "green": 12
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": -0.4000000000000057,
            "dimensionsDelta": {
              "transport": 7.333333333333329,
              "green": 2.0,
              "social": -10.0,
              "safety": 0.0,
              "services": -1.3333333333333357
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": 2.5999999999999943,
                "dimensionsDelta": {
                  "transport": 10,
                  "green": 3,
                  "social": 0,
                  "safety": 0,
                  "services": 0
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": -1.2000000000000028,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": -6,
                  "safety": 0,
                  "services": 0
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": -2.6000000000000014,
                "dimensionsDelta": {
                  "transport": 12,
                  "green": 3,
                  "social": -24,
                  "safety": 0,
                  "services": -4
                }
              }
            ]
          }
        },
        {
          "removedActionId": "school_new",
          "addedActionId": "school_modular",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "bus_lanes",
              "lighting_smart",
              "park_local",
              "school_modular",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "bus_lanes",
                "lighting_smart",
                "park_local",
                "school_modular",
                "services_online"
              ]
            },
            "totalCost": 96,
            "remainingBudget": 4,
            "warnings": [],
            "valid": true,
            "officialScore": 56.60000000000001,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 56.33333333333333,
                "green": 51.99999999999999,
                "social": 56.666666666666664,
                "safety": 55.33333333333333,
                "services": 62.66666666666666
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 61,
                    "green": 57,
                    "social": 46,
                    "safety": 55,
                    "services": 63
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 56.400000000000006,
                  "scoreDelta": 11.400000000000006
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 68,
                    "green": 49,
                    "social": 58,
                    "safety": 52,
                    "services": 67
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 58.800000000000004,
                  "scoreDelta": 4.800000000000004
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 40,
                    "green": 50,
                    "social": 66,
                    "safety": 59,
                    "services": 58
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 54.6,
                  "scoreDelta": 13.799999999999997
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 10.000000000000007
            },
            "trace": [
              {
                "actionId": "bus_lanes",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "transport": 16,
                    "green": -2
                  },
                  "D2": {
                    "transport": 10,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "lighting_smart",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D3": {
                    "safety": 18,
                    "services": 2
                  },
                  "D1": {
                    "safety": 8,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "park_local",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D1": {
                    "green": 18,
                    "safety": 3
                  },
                  "D3": {
                    "green": 12
                  }
                }
              },
              {
                "actionId": "school_modular",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D3": {
                    "social": 22,
                    "services": 3
                  },
                  "D2": {
                    "social": 3
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": -0.3999999999999915,
            "dimensionsDelta": {
              "transport": 0.0,
              "green": 0.0,
              "social": -1.6666666666666643,
              "safety": 0.0,
              "services": -0.3333333333333357
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": 0.0,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 0,
                  "safety": 0,
                  "services": 0
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": -0.6000000000000014,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": -3,
                  "safety": 0,
                  "services": 0
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": -0.6000000000000014,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": -2,
                  "safety": 0,
                  "services": -1
                }
              }
            ]
          }
        },
        {
          "removedActionId": "school_new",
          "addedActionId": "service_centers",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "bus_lanes",
              "lighting_smart",
              "park_local",
              "service_centers",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "bus_lanes",
                "lighting_smart",
                "park_local",
                "service_centers",
                "services_online"
              ]
            },
            "totalCost": 78,
            "remainingBudget": 22,
            "warnings": [],
            "valid": true,
            "officialScore": 56.53333333333333,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 56.33333333333333,
                "green": 51.99999999999999,
                "social": 48.33333333333333,
                "safety": 55.33333333333333,
                "services": 70.66666666666666
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 61,
                    "green": 57,
                    "social": 46,
                    "safety": 55,
                    "services": 73
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 58.400000000000006,
                  "scoreDelta": 13.400000000000006
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 68,
                    "green": 49,
                    "social": 55,
                    "safety": 52,
                    "services": 72
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 59.2,
                  "scoreDelta": 5.200000000000003
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 40,
                    "green": 50,
                    "social": 44,
                    "safety": 59,
                    "services": 67
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 52.0,
                  "scoreDelta": 11.199999999999996
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 9.93333333333333
            },
            "trace": [
              {
                "actionId": "bus_lanes",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "transport": 16,
                    "green": -2
                  },
                  "D2": {
                    "transport": 10,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "lighting_smart",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D3": {
                    "safety": 18,
                    "services": 2
                  },
                  "D1": {
                    "safety": 8,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "park_local",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D1": {
                    "green": 18,
                    "safety": 3
                  },
                  "D3": {
                    "green": 12
                  }
                }
              },
              {
                "actionId": "service_centers",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "services": 10
                  },
                  "D2": {
                    "services": 5
                  },
                  "D3": {
                    "services": 12
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": -0.46666666666666856,
            "dimensionsDelta": {
              "transport": 0.0,
              "green": 0.0,
              "social": -10.0,
              "safety": 0.0,
              "services": 7.666666666666664
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": 2.0,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 0,
                  "safety": 0,
                  "services": 10
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": -0.20000000000000284,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": -6,
                  "safety": 0,
                  "services": 5
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": -3.200000000000003,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": -24,
                  "safety": 0,
                  "services": 8
                }
              }
            ]
          }
        }
      ]
    }
  },
  "eventConfirm": {
    "ok": true,
    "data": {
      "base": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 90,
        "remainingBudget": 10,
        "warnings": [],
        "valid": true,
        "officialScore": 57.0,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 58.33333333333333,
            "safety": 55.33333333333333,
            "services": 62.99999999999999
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 61,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 59.400000000000006,
              "scoreDelta": 5.400000000000006
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 68,
                "safety": 59,
                "services": 59
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 55.2,
              "scoreDelta": 14.399999999999999
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.399999999999999
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "event": {
        "id": "school_site_unavailable",
        "title": "Строительство школы отменено: участок недоступен",
        "description": "Учебный сценарий: план еще не исполнен; вся стоимость школы возвращается в бюджет ветки.",
        "kind": "cancellation",
        "blockedActionId": "school_new"
      },
      "branch": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_modular",
            "services_online"
          ]
        },
        "totalCost": 96,
        "remainingBudget": 4,
        "warnings": [],
        "valid": true,
        "officialScore": 56.60000000000001,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 56.666666666666664,
            "safety": 55.33333333333333,
            "services": 62.66666666666666
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 58,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 58.800000000000004,
              "scoreDelta": 4.800000000000004
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 66,
                "safety": 59,
                "services": 58
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 54.6,
              "scoreDelta": 13.799999999999997
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.000000000000007
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_modular",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D3": {
                "social": 22,
                "services": 3
              },
              "D2": {
                "social": 3
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "comparison": {
        "scoreDelta": -0.3999999999999915,
        "dimensionsDelta": {
          "transport": 0.0,
          "green": 0.0,
          "social": -1.6666666666666643,
          "safety": 0.0,
          "services": -0.3333333333333357
        },
        "districts": [
          {
            "districtId": "D1",
            "scoreDelta": 0.0,
            "dimensionsDelta": {
              "transport": 0,
              "green": 0,
              "social": 0,
              "safety": 0,
              "services": 0
            }
          },
          {
            "districtId": "D2",
            "scoreDelta": -0.6000000000000014,
            "dimensionsDelta": {
              "transport": 0,
              "green": 0,
              "social": -3,
              "safety": 0,
              "services": 0
            }
          },
          {
            "districtId": "D3",
            "scoreDelta": -0.6000000000000014,
            "dimensionsDelta": {
              "transport": 0,
              "green": 0,
              "social": -2,
              "safety": 0,
              "services": -1
            }
          }
        ]
      }
    }
  },
  "opportunityPreview": {
    "ok": true,
    "data": {
      "base": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 90,
        "remainingBudget": 10,
        "warnings": [],
        "valid": true,
        "officialScore": 57.0,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 58.33333333333333,
            "safety": 55.33333333333333,
            "services": 62.99999999999999
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 61,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 59.400000000000006,
              "scoreDelta": 5.400000000000006
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 68,
                "safety": 59,
                "services": 59
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 55.2,
              "scoreDelta": 14.399999999999999
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.399999999999999
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "event": {
        "id": "digital_grant_available",
        "title": "Открылась грантовая программа цифровых услуг",
        "description": "Предварительно описанный проект стал доступен. Он должен заменить одно из пяти мероприятий.",
        "kind": "opportunity",
        "unlockedActionId": "digital_grant"
      },
      "draft": {
        "modelVersion": "demo-v1",
        "actionIds": [
          "bus_lanes",
          "lighting_smart",
          "park_local",
          "school_new",
          "services_online"
        ]
      },
      "draftResult": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 90,
        "remainingBudget": 10,
        "warnings": [],
        "valid": true,
        "officialScore": 57.0,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 58.33333333333333,
            "safety": 55.33333333333333,
            "services": 62.99999999999999
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 61,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 59.400000000000006,
              "scoreDelta": 5.400000000000006
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 68,
                "safety": 59,
                "services": 59
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 55.2,
              "scoreDelta": 14.399999999999999
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.399999999999999
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "requiresReplacement": true,
      "replacementOptions": [
        {
          "removedActionId": "bus_lanes",
          "addedActionId": "digital_grant",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "digital_grant",
              "lighting_smart",
              "park_local",
              "school_new",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "digital_grant",
                "lighting_smart",
                "park_local",
                "school_new",
                "services_online"
              ]
            },
            "totalCost": 80,
            "remainingBudget": 20,
            "warnings": [],
            "valid": true,
            "officialScore": 58.66666666666667,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 47.66666666666666,
                "green": 52.99999999999999,
                "social": 59.33333333333333,
                "safety": 55.33333333333333,
                "services": 78.0
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 45,
                    "green": 59,
                    "social": 46,
                    "safety": 55,
                    "services": 78
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 56.6,
                  "scoreDelta": 11.600000000000001
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 58,
                    "green": 50,
                    "social": 61,
                    "safety": 52,
                    "services": 82
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 60.60000000000001,
                  "scoreDelta": 6.6000000000000085
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 40,
                    "green": 50,
                    "social": 71,
                    "safety": 59,
                    "services": 74
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 58.800000000000004,
                  "scoreDelta": 18.0
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 12.06666666666667
            },
            "trace": [
              {
                "actionId": "digital_grant",
                "active": true,
                "lagMonths": 0,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 15
                  },
                  "D3": {
                    "services": 15,
                    "social": 3
                  }
                }
              },
              {
                "actionId": "lighting_smart",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D3": {
                    "safety": 18,
                    "services": 2
                  },
                  "D1": {
                    "safety": 8,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "park_local",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D1": {
                    "green": 18,
                    "safety": 3
                  },
                  "D3": {
                    "green": 12
                  }
                }
              },
              {
                "actionId": "school_new",
                "active": true,
                "lagMonths": 6,
                "appliedEffects": {
                  "D3": {
                    "social": 24,
                    "services": 4
                  },
                  "D2": {
                    "social": 6
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": 1.6666666666666714,
            "dimensionsDelta": {
              "transport": -8.666666666666671,
              "green": 1.0,
              "social": 1.0,
              "safety": 0.0,
              "services": 15.000000000000007
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": 0.19999999999999574,
                "dimensionsDelta": {
                  "transport": -16,
                  "green": 2,
                  "social": 0,
                  "safety": 0,
                  "services": 15
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": 1.2000000000000028,
                "dimensionsDelta": {
                  "transport": -10,
                  "green": 1,
                  "social": 0,
                  "safety": 0,
                  "services": 15
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": 3.6000000000000014,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 3,
                  "safety": 0,
                  "services": 15
                }
              }
            ]
          }
        },
        {
          "removedActionId": "lighting_smart",
          "addedActionId": "digital_grant",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "bus_lanes",
              "digital_grant",
              "park_local",
              "school_new",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "bus_lanes",
                "digital_grant",
                "park_local",
                "school_new",
                "services_online"
              ]
            },
            "totalCost": 86,
            "remainingBudget": 14,
            "warnings": [],
            "valid": true,
            "officialScore": 58.400000000000006,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 56.33333333333333,
                "green": 52.33333333333333,
                "social": 59.33333333333333,
                "safety": 46.666666666666664,
                "services": 77.33333333333333
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 61,
                    "green": 58,
                    "social": 46,
                    "safety": 47,
                    "services": 78
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 58.00000000000001,
                  "scoreDelta": 13.000000000000007
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 68,
                    "green": 49,
                    "social": 61,
                    "safety": 52,
                    "services": 82
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 62.400000000000006,
                  "scoreDelta": 8.400000000000006
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 40,
                    "green": 50,
                    "social": 71,
                    "safety": 41,
                    "services": 72
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 54.800000000000004,
                  "scoreDelta": 14.0
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 11.800000000000004
            },
            "trace": [
              {
                "actionId": "bus_lanes",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "transport": 16,
                    "green": -2
                  },
                  "D2": {
                    "transport": 10,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "digital_grant",
                "active": true,
                "lagMonths": 0,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 15
                  },
                  "D3": {
                    "services": 15,
                    "social": 3
                  }
                }
              },
              {
                "actionId": "park_local",
                "active": true,
                "lagMonths": 3,
                "appliedEffects": {
                  "D1": {
                    "green": 18,
                    "safety": 3
                  },
                  "D3": {
                    "green": 12
                  }
                }
              },
              {
                "actionId": "school_new",
                "active": true,
                "lagMonths": 6,
                "appliedEffects": {
                  "D3": {
                    "social": 24,
                    "services": 4
                  },
                  "D2": {
                    "social": 6
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": 1.4000000000000057,
            "dimensionsDelta": {
              "transport": 0.0,
              "green": 0.3333333333333357,
              "social": 1.0,
              "safety": -8.666666666666664,
              "services": 14.333333333333336
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": 1.6000000000000014,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 1,
                  "social": 0,
                  "safety": -8,
                  "services": 15
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": 3.0,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 0,
                  "safety": 0,
                  "services": 15
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": -0.3999999999999986,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 3,
                  "safety": -18,
                  "services": 13
                }
              }
            ]
          }
        },
        {
          "removedActionId": "park_local",
          "addedActionId": "digital_grant",
          "plan": {
            "modelVersion": "demo-v1",
            "actionIds": [
              "bus_lanes",
              "digital_grant",
              "lighting_smart",
              "school_new",
              "services_online"
            ]
          },
          "result": {
            "plan": {
              "modelVersion": "demo-v1",
              "actionIds": [
                "bus_lanes",
                "digital_grant",
                "lighting_smart",
                "school_new",
                "services_online"
              ]
            },
            "totalCost": 82,
            "remainingBudget": 18,
            "warnings": [],
            "valid": true,
            "officialScore": 58.0,
            "errors": [],
            "metrics": {
              "dimensions": {
                "transport": 56.33333333333333,
                "green": 42.0,
                "social": 59.33333333333333,
                "safety": 54.33333333333333,
                "services": 78.0
              },
              "districts": [
                {
                  "districtId": "D1",
                  "before": {
                    "transport": 45,
                    "green": 42,
                    "social": 46,
                    "safety": 44,
                    "services": 48
                  },
                  "after": {
                    "transport": 61,
                    "green": 39,
                    "social": 46,
                    "safety": 52,
                    "services": 78
                  },
                  "scoreBefore": 45.0,
                  "scoreAfter": 55.2,
                  "scoreDelta": 10.200000000000003
                },
                {
                  "districtId": "D2",
                  "before": {
                    "transport": 58,
                    "green": 50,
                    "social": 55,
                    "safety": 52,
                    "services": 55
                  },
                  "after": {
                    "transport": 68,
                    "green": 49,
                    "social": 61,
                    "safety": 52,
                    "services": 82
                  },
                  "scoreBefore": 54.0,
                  "scoreAfter": 62.400000000000006,
                  "scoreDelta": 8.400000000000006
                },
                {
                  "districtId": "D3",
                  "before": {
                    "transport": 40,
                    "green": 38,
                    "social": 42,
                    "safety": 41,
                    "services": 43
                  },
                  "after": {
                    "transport": 40,
                    "green": 38,
                    "social": 71,
                    "safety": 59,
                    "services": 74
                  },
                  "scoreBefore": 40.800000000000004,
                  "scoreAfter": 56.400000000000006,
                  "scoreDelta": 15.600000000000001
                }
              ],
              "baselineOfficialScore": 46.6,
              "deltaFromBaseline": 11.399999999999999
            },
            "trace": [
              {
                "actionId": "bus_lanes",
                "active": true,
                "lagMonths": 2,
                "appliedEffects": {
                  "D1": {
                    "transport": 16,
                    "green": -2
                  },
                  "D2": {
                    "transport": 10,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "digital_grant",
                "active": true,
                "lagMonths": 0,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 15
                  },
                  "D3": {
                    "services": 15,
                    "social": 3
                  }
                }
              },
              {
                "actionId": "lighting_smart",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D3": {
                    "safety": 18,
                    "services": 2
                  },
                  "D1": {
                    "safety": 8,
                    "green": -1
                  }
                }
              },
              {
                "actionId": "school_new",
                "active": true,
                "lagMonths": 6,
                "appliedEffects": {
                  "D3": {
                    "social": 24,
                    "services": 4
                  },
                  "D2": {
                    "social": 6
                  }
                }
              },
              {
                "actionId": "services_online",
                "active": true,
                "lagMonths": 1,
                "appliedEffects": {
                  "D1": {
                    "services": 15
                  },
                  "D2": {
                    "services": 12
                  },
                  "D3": {
                    "services": 10,
                    "social": 2
                  }
                }
              }
            ]
          },
          "comparison": {
            "scoreDelta": 1.0,
            "dimensionsDelta": {
              "transport": 0.0,
              "green": -9.999999999999993,
              "social": 1.0,
              "safety": -1.0,
              "services": 15.000000000000007
            },
            "districts": [
              {
                "districtId": "D1",
                "scoreDelta": -1.2000000000000028,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": -18,
                  "social": 0,
                  "safety": -3,
                  "services": 15
                }
              },
              {
                "districtId": "D2",
                "scoreDelta": 3.0,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": 0,
                  "social": 0,
                  "safety": 0,
                  "services": 15
                }
              },
              {
                "districtId": "D3",
                "scoreDelta": 1.2000000000000028,
                "dimensionsDelta": {
                  "transport": 0,
                  "green": -12,
                  "social": 3,
                  "safety": 0,
                  "services": 15
                }
              }
            ]
          }
        }
      ]
    }
  },
  "opportunityConfirm": {
    "ok": true,
    "data": {
      "base": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "bus_lanes",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 90,
        "remainingBudget": 10,
        "warnings": [],
        "valid": true,
        "officialScore": 57.0,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 56.33333333333333,
            "green": 51.99999999999999,
            "social": 58.33333333333333,
            "safety": 55.33333333333333,
            "services": 62.99999999999999
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 61,
                "green": 57,
                "social": 46,
                "safety": 55,
                "services": 63
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.400000000000006,
              "scoreDelta": 11.400000000000006
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 68,
                "green": 49,
                "social": 61,
                "safety": 52,
                "services": 67
              },
              "scoreBefore": 54.0,
              "scoreAfter": 59.400000000000006,
              "scoreDelta": 5.400000000000006
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 68,
                "safety": 59,
                "services": 59
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 55.2,
              "scoreDelta": 14.399999999999999
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 10.399999999999999
        },
        "trace": [
          {
            "actionId": "bus_lanes",
            "active": true,
            "lagMonths": 2,
            "appliedEffects": {
              "D1": {
                "transport": 16,
                "green": -2
              },
              "D2": {
                "transport": 10,
                "green": -1
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "event": {
        "id": "digital_grant_available",
        "title": "Открылась грантовая программа цифровых услуг",
        "description": "Предварительно описанный проект стал доступен. Он должен заменить одно из пяти мероприятий.",
        "kind": "opportunity",
        "unlockedActionId": "digital_grant"
      },
      "branch": {
        "plan": {
          "modelVersion": "demo-v1",
          "actionIds": [
            "digital_grant",
            "lighting_smart",
            "park_local",
            "school_new",
            "services_online"
          ]
        },
        "totalCost": 80,
        "remainingBudget": 20,
        "warnings": [],
        "valid": true,
        "officialScore": 58.66666666666667,
        "errors": [],
        "metrics": {
          "dimensions": {
            "transport": 47.66666666666666,
            "green": 52.99999999999999,
            "social": 59.33333333333333,
            "safety": 55.33333333333333,
            "services": 78.0
          },
          "districts": [
            {
              "districtId": "D1",
              "before": {
                "transport": 45,
                "green": 42,
                "social": 46,
                "safety": 44,
                "services": 48
              },
              "after": {
                "transport": 45,
                "green": 59,
                "social": 46,
                "safety": 55,
                "services": 78
              },
              "scoreBefore": 45.0,
              "scoreAfter": 56.6,
              "scoreDelta": 11.600000000000001
            },
            {
              "districtId": "D2",
              "before": {
                "transport": 58,
                "green": 50,
                "social": 55,
                "safety": 52,
                "services": 55
              },
              "after": {
                "transport": 58,
                "green": 50,
                "social": 61,
                "safety": 52,
                "services": 82
              },
              "scoreBefore": 54.0,
              "scoreAfter": 60.60000000000001,
              "scoreDelta": 6.6000000000000085
            },
            {
              "districtId": "D3",
              "before": {
                "transport": 40,
                "green": 38,
                "social": 42,
                "safety": 41,
                "services": 43
              },
              "after": {
                "transport": 40,
                "green": 50,
                "social": 71,
                "safety": 59,
                "services": 74
              },
              "scoreBefore": 40.800000000000004,
              "scoreAfter": 58.800000000000004,
              "scoreDelta": 18.0
            }
          ],
          "baselineOfficialScore": 46.6,
          "deltaFromBaseline": 12.06666666666667
        },
        "trace": [
          {
            "actionId": "digital_grant",
            "active": true,
            "lagMonths": 0,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 15
              },
              "D3": {
                "services": 15,
                "social": 3
              }
            }
          },
          {
            "actionId": "lighting_smart",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D3": {
                "safety": 18,
                "services": 2
              },
              "D1": {
                "safety": 8,
                "green": -1
              }
            }
          },
          {
            "actionId": "park_local",
            "active": true,
            "lagMonths": 3,
            "appliedEffects": {
              "D1": {
                "green": 18,
                "safety": 3
              },
              "D3": {
                "green": 12
              }
            }
          },
          {
            "actionId": "school_new",
            "active": true,
            "lagMonths": 6,
            "appliedEffects": {
              "D3": {
                "social": 24,
                "services": 4
              },
              "D2": {
                "social": 6
              }
            }
          },
          {
            "actionId": "services_online",
            "active": true,
            "lagMonths": 1,
            "appliedEffects": {
              "D1": {
                "services": 15
              },
              "D2": {
                "services": 12
              },
              "D3": {
                "services": 10,
                "social": 2
              }
            }
          }
        ]
      },
      "comparison": {
        "scoreDelta": 1.6666666666666714,
        "dimensionsDelta": {
          "transport": -8.666666666666671,
          "green": 1.0,
          "social": 1.0,
          "safety": 0.0,
          "services": 15.000000000000007
        },
        "districts": [
          {
            "districtId": "D1",
            "scoreDelta": 0.19999999999999574,
            "dimensionsDelta": {
              "transport": -16,
              "green": 2,
              "social": 0,
              "safety": 0,
              "services": 15
            }
          },
          {
            "districtId": "D2",
            "scoreDelta": 1.2000000000000028,
            "dimensionsDelta": {
              "transport": -10,
              "green": 1,
              "social": 0,
              "safety": 0,
              "services": 15
            }
          },
          {
            "districtId": "D3",
            "scoreDelta": 3.6000000000000014,
            "dimensionsDelta": {
              "transport": 0,
              "green": 0,
              "social": 3,
              "safety": 0,
              "services": 15
            }
          }
        ]
      }
    }
  },
  "explanation": {
    "ok": true,
    "data": {
      "source": "template",
      "summary": "Отмена школы компенсирована заменой на модульные учебные корпуса.",
      "observations": [
        {
          "actionIds": [
            "school_new",
            "school_modular"
          ],
          "districtIds": [
            "D2",
            "D3"
          ],
          "text": "Учебные корпуса дают меньший социальный эффект, чем исходный проект школы, в пределах демонстрационной модели."
        }
      ],
      "tradeoff": "Замена укладывается в бюджет, но увеличивает расходы по сравнению с исходным планом.",
      "limitation": "Это шаблонное объяснение на синтетических данных, не прогноз реального города."
    }
  }
} satisfies FixtureChecks;
