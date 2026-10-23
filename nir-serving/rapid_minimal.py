"""Minimal inference-only RAPiD model. Architecture/anchors follow duanzhiihao/RAPiD models/{rapid.py,backbones.py}.
Derived from RAPiD's noncommercial-source code. Use only for experimental evaluation.
No training and no external module imports; checkpoint is loaded with weights_only=True.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F

def CBL(a,b,k,s):
 return nn.Sequential(nn.Conv2d(a,b,k,s,padding=(k-1)//2,bias=False), nn.BatchNorm2d(b,eps=1e-5,momentum=.1),nn.LeakyReLU(.1))

class DarkBlock(nn.Module):
 def __init__(self,ch,hidden):
  super().__init__(); self.cbl_0=CBL(ch,hidden,1,1);self.cbl_1=CBL(hidden,ch,3,1)
 def forward(self,x):return x+self.cbl_1(self.cbl_0(x))

class Darknet53(nn.Module):
 def __init__(self):
  super().__init__(); self.netlist=nn.ModuleList([CBL(3,32,3,1),CBL(32,64,3,2),DarkBlock(64,32),CBL(64,128,3,2)] + [DarkBlock(128,64) for _ in range(2)] + [CBL(128,256,3,2)] + [DarkBlock(256,128) for _ in range(8)] + [CBL(256,512,3,2)] + [DarkBlock(512,256) for _ in range(8)] + [CBL(512,1024,3,2)] + [DarkBlock(1024,512) for _ in range(4)])
  assert len(self.netlist)==29
 def forward(self,x):
  s=m=l=None
  for i,layer in enumerate(self.netlist):
   x=layer(x)
   if i==14:s=x
   if i==23:m=x
  return s,m,x

class YOLOBranch(nn.Module):
 def __init__(self,in_ch,prev_ch=None):
  super().__init__();self.process=CBL(prev_ch[0],prev_ch[1],1,1) if prev_ch else None
  cat_ch=in_ch+(prev_ch[1] if prev_ch else 0)
  self.cbl_0=CBL(cat_ch,in_ch//2,1,1);self.cbl_1=CBL(in_ch//2,in_ch,3,1)
  self.cbl_2=CBL(in_ch,in_ch//2,1,1);self.cbl_3=CBL(in_ch//2,in_ch,3,1)
  self.cbl_4=CBL(in_ch,in_ch//2,1,1);self.cbl_5=CBL(in_ch//2,in_ch,3,1)
  self.to_box=nn.Conv2d(in_ch,18,kernel_size=1)
 def forward(self,x,previous=None):
  if previous is not None:
   p=F.interpolate(self.process(previous),scale_factor=2,mode='nearest');x=torch.cat((p,x),1)
  x=self.cbl_3(self.cbl_2(self.cbl_1(self.cbl_0(x))))
  feature=self.cbl_4(x)
  return self.to_box(self.cbl_5(feature)),feature

class RAPiD(nn.Module):
 def __init__(self):
  super().__init__();self.backbone=Darknet53();self.branch_L=YOLOBranch(1024);self.branch_M=YOLOBranch(512,prev_ch=(512,256));self.branch_S=YOLOBranch(256,prev_ch=(256,128))
  self.register_buffer('anchors', torch.tensor([[18.7807,33.4659],[28.8912,61.7536],[48.6849,68.3897],[45.0668,101.4673],[63.0952,113.5382],[81.3909,134.4554],[91.7364,144.9949],[137.5189,178.4791],[194.4429,250.7985]]), persistent=False)
 @staticmethod
 def decode(raw,anchors,hw):
  B,C,H,W=raw.shape;z=raw.reshape(B,3,6,H,W).permute(0,1,3,4,2).contiguous()
  dx=torch.arange(W,device=raw.device).view(1,1,1,W);dy=torch.arange(H,device=raw.device).view(1,1,H,1)
  x=(z[...,0].sigmoid()+dx)/W*hw[1];y=(z[...,1].sigmoid()+dy)/H*hw[0]
  w=z[...,2].clamp(-20,20).exp()*anchors[:,0].view(1,3,1,1)
  h=z[...,3].clamp(-20,20).exp()*anchors[:,1].view(1,3,1,1)
  a=z[...,4].sigmoid()*360-180;c=z[...,5].sigmoid()
  return torch.stack((x,y,w,h,a,c),-1).view(B,-1,6)
 def forward(self,x):
  s,m,l=self.backbone(x)
  dl,pl=self.branch_L(l)
  dm,pm=self.branch_M(m,pl)
  ds,_=self.branch_S(s,pm)
  return torch.cat((self.decode(dl,self.anchors[[6,7,8]],x.shape[2:]), self.decode(dm,self.anchors[[3,4,5]],x.shape[2:]),self.decode(ds,self.anchors[[0,1,2]],x.shape[2:])),1)
