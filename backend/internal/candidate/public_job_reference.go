package candidate

import "regexp"

var publicJobReference = regexp.MustCompile(`^SWX-JOB-[0-9]{4}-[0-9]{5,10}$`)
