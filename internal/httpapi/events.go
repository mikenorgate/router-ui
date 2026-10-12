package httpapi

import (
	"encoding/json"
	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/model"
	"strings"
)

func summaryEvents(items []json.RawMessage, role string) ([]json.RawMessage, error) {
	if auth.Can(role, "operator") {
		return items, nil
	}
	out := []json.RawMessage{}
	for _, raw := range items {
		var e model.Event
		if err := json.Unmarshal(raw, &e); err != nil {
			return nil, err
		}
		e.Detail = ""
		switch strings.ToLower(e.Kind) {
		case "flow", "dns", "connection", "security":
			e.Title = "Restricted traffic event; Operator access required"
		}
		b, err := json.Marshal(e)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, nil
}
