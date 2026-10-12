package httpapi

import (
	"context"
	"github.com/mikenorgate/router-ui/internal/model"
)

type deviceResponse struct {
	model.Device
	Sources      []model.Source `json:"sources"`
	ReportedName string         `json:"reported_name"`
}

func (a *API) deviceView(ctx context.Context, d model.Device, sources []model.Source) (deviceResponse, error) {
	v := deviceResponse{Device: d, ReportedName: d.Name, Sources: []model.Source{}}
	for _, id := range d.Sources {
		found := false
		for _, s := range sources {
			if s.ID == id {
				v.Sources = append(v.Sources, s)
				found = true
				break
			}
		}
		if !found {
			v.Sources = append(v.Sources, model.Source{ID: id, Status: "missing", Coverage: "Device refers to a source without a current acknowledgement"})
		}
	}
	note, err := a.Store.Annotation(ctx, d.ID)
	if err != nil {
		return v, err
	}
	if note.Alias != "" {
		v.Name = note.Alias
	}
	return v, nil
}
