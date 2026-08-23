// Keep numeric Low-Hanging ranges aligned with gated grades.
const prfNeedBase=lowHangingScore;
lowHangingScore=function(l){
  const x=prfNeedBase(l);
  if(!x.reachable&&x.score>=60){
    x.score=59;
    x.grade=x.needScore>=20?'POSSIBLE':'LOW';
  }
  return x;
};
render();
