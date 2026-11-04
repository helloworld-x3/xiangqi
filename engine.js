const Xiangqi=(()=>{
const other=s=>s==='r'?'b':'r';
function initial(){const b=Array(90).fill(null);for(const [s,y] of [['b',0],['r',9]]){['R','H','E','A','K','A','E','H','R'].forEach((t,x)=>b[y*9+x]={s,t});for(const x of [1,7])b[(s==='b'?2:7)*9+x]={s,t:'C'};for(const x of [0,2,4,6,8])b[(s==='b'?3:6)*9+x]={s,t:'P'};}return b;}
function pseudo(b,a,z){const p=b[a],q=b[z];if(!p||a===z||z<0||z>=90||q?.s===p.s)return false;const x=a%9,y=Math.floor(a/9),u=z%9,v=Math.floor(z/9),dx=u-x,dy=v-y,ax=Math.abs(dx),ay=Math.abs(dy);const palace=u>=3&&u<=5&&(p.s==='r'?v>=7:v<=2);let n=0;if(dx===0||dy===0){const step=dx===0?Math.sign(dy)*9:Math.sign(dx);for(let i=a+step;i!==z;i+=step)if(b[i])n++;}
switch(p.t){case 'K':return (ax+ay===1&&palace)||(q?.t==='K'&&dx===0&&n===0);case 'A':return ax===1&&ay===1&&palace;case 'E':return ax===2&&ay===2&&(p.s==='r'?v>=5:v<=4)&&!b[(y+dy/2)*9+x+dx/2];case 'H':return ((ax===2&&ay===1&&!b[y*9+x+Math.sign(dx)])||(ax===1&&ay===2&&!b[(y+Math.sign(dy))*9+x]));case 'R':return (dx===0||dy===0)&&n===0;case 'C':return (dx===0||dy===0)&&n===(q?1:0);case 'P':return (dx===0&&dy===(p.s==='r'?-1:1))||(ay===0&&ax===1&&(p.s==='r'?y<=4:y>=5));}return false;}
function check(b,s){const k=b.findIndex(p=>p?.s===s&&p.t==='K');return k<0||b.some((p,i)=>p?.s===other(s)&&pseudo(b,i,k));}
function apply(b,a,z){const c=b.slice();c[z]=c[a];c[a]=null;return c;}
function legal(b,a){if(!b[a])return [];return Array.from({length:90},(_,z)=>z).filter(z=>b[z]?.t!=='K'&&pseudo(b,a,z)&&!check(apply(b,a,z),b[a].s));}
function state(b,s){const checked=check(b,s);const available=b.some((p,i)=>p?.s===s&&legal(b,i).length);return {checked,over:!available,reason:available?null:checked?'Checkmate':'Stalemate',winner:available?null:other(s)};}
return {initial,pseudo,check,apply,legal,state,other};})();
if (typeof module !== "undefined" && module.exports) module.exports = Xiangqi;
