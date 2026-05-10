// ========================================
// SPONSOR EXCEL REPORT - Professional Multi-Sheet
// ========================================

const SponsorExcel = {
  C: {
    dark:'FF0F172A', blue:'FF2563EB', green:'FF16A34A', amber:'FFD97706',
    red:'FFDC2626', white:'FFFFFFFF', light:'FFF8FAFC', border:'FFE2E8F0',
    muted:'FF64748B', blueBg:'FFDBEAFE', greenBg:'FFDCFCE7', amberBg:'FFFFFBEB', redBg:'FFFEF2F2'
  },

  get darkFill() { return {type:'pattern',pattern:'solid',fgColor:{argb:this.C.dark}}; },
  get lightFill() { return {type:'pattern',pattern:'solid',fgColor:{argb:this.C.light}}; },
  get border() {
    const b = {style:'thin',color:{argb:this.C.border}};
    return {top:b,bottom:b,left:b,right:b};
  },
  fill(c) { return {type:'pattern',pattern:'solid',fgColor:{argb:c}}; },

  addHeader(ws, title, periodLabel, cols) {
    ws.mergeCells(1,1,1,cols);
    const h1=ws.getCell('A1');
    h1.value='INSPIRING ROADS LOGISTICS';
    h1.font={name:'Calibri',bold:true,size:18,color:{argb:this.C.white}};
    h1.fill=this.darkFill; h1.alignment={vertical:'middle',horizontal:'center'};
    ws.getRow(1).height=36;

    ws.mergeCells(2,1,2,cols);
    const h2=ws.getCell('A2');
    h2.value=`${title}  |  ${periodLabel}`;
    h2.font={name:'Calibri',bold:true,size:12,color:{argb:'FFCBD5E1'}};
    h2.fill=this.darkFill; h2.alignment={vertical:'middle',horizontal:'center'};
    ws.getRow(2).height=26;

    ws.mergeCells(3,1,3,cols);
    const h3=ws.getCell('A3');
    h3.value=`Generated: ${new Date().toLocaleDateString('en-US',{dateStyle:'full'})}  |  Prepared by: Abdullah Khan (Supervisor)`;
    h3.font={name:'Calibri',italic:true,size:10,color:{argb:this.C.muted}};
    h3.fill=this.darkFill; h3.alignment={vertical:'middle',horizontal:'center'};
    h3.border={bottom:{style:'thick',color:{argb:this.C.blue}}};
    ws.getRow(3).height=22;
  },

  sectionTitle(ws, r, cols, text, bgColor) {
    ws.mergeCells(r,1,r,cols);
    const c=ws.getCell(`A${r}`);
    c.value='  '+text;
    c.font={name:'Calibri',bold:true,size:13,color:{argb:'FF1E3A8A'}};
    c.fill=this.fill(bgColor||this.C.blueBg);
    c.alignment={vertical:'middle'};
    ws.getRow(r).height=30;
  },

  headerRow(ws, r, values) {
    const row=ws.getRow(r);
    row.values=values; row.height=26;
    for(let i=1;i<=values.length;i++){
      const c=row.getCell(i);
      c.font={name:'Calibri',bold:true,size:11,color:{argb:this.C.white}};
      c.fill=this.darkFill;
      c.alignment={vertical:'middle',horizontal:'center',wrapText:true};
      c.border=this.border;
    }
  },

  styleRows(ws, from, to, cols) {
    for(let r=from;r<=to;r++){
      const row=ws.getRow(r); row.height=22;
      for(let c=1;c<=cols;c++){
        const cell=row.getCell(c);
        cell.font={name:'Calibri',size:11};
        cell.border=this.border;
        cell.alignment={vertical:'middle',wrapText:true};
        if((r-from)%2===1) cell.fill=this.lightFill;
      }
    }
  },

  totalRow(ws, r, cols, label, amountCol, amount, fillColor) {
    const row=ws.getRow(r); row.height=28;
    ws.mergeCells(r,1,r,amountCol-1);
    const lc=row.getCell(1);
    lc.value=label;
    lc.font={name:'Calibri',bold:true,size:12};
    lc.alignment={horizontal:'right',vertical:'middle'};
    lc.fill=this.fill(fillColor); lc.border=this.border;
    const vc=row.getCell(amountCol);
    vc.value=amount; vc.numFmt='#,##0.00 "SAR"';
    vc.font={name:'Calibri',bold:true,size:13};
    vc.fill=this.fill(fillColor); vc.border=this.border;
    vc.alignment={horizontal:'right',vertical:'middle'};
    for(let c=amountCol+1;c<=cols;c++){
      row.getCell(c).fill=this.fill(fillColor);
      row.getCell(c).border=this.border;
    }
  },

  async generate(start, end) {
    Utils.showLoading('Building Sponsor Excel...','Organizing data into clean sheets');
    try {
      if(typeof ExcelJS==='undefined') throw new Error('ExcelJS not loaded');

      // Fetch ALL data + cycle data
      const [allExpenses, allFunds, cycleExpenses, cycleFunds] = await Promise.all([
        API.getExpenses(null, null),
        API.getFunds(null, null),
        API.getExpenses(start, end),
        API.getFunds(start, end)
      ]);

      let periodLabel = 'All Time';
      let isAllTime = !start && !end;
      if(start && end){
        const s=new Date(start+'T00:00:00'), e=new Date(end+'T00:00:00');
        periodLabel=`${s.toLocaleDateString('en-US',{month:'short',day:'numeric'})} - ${e.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;
      }

      // Use cycle data for the report, but all-time for the dashboard context
      const expenses = isAllTime ? allExpenses : cycleExpenses;
      const funds = isAllTime ? allFunds : cycleFunds;

      // ALL-TIME stats (matches dashboard exactly)
      const allTimeReceived = allFunds.reduce((s,f) => s+(parseFloat(f.amount)||0), 0);
      const allTimeExpenses = allExpenses.reduce((s,e) => {
        if(e.category==='Manual Deduction') return s;
        return s+(parseFloat(e.amount)||0);
      }, 0);
      const allTimePocket = Math.max(0, allTimeExpenses - allTimeReceived);
      const allTimeRemaining = allTimeReceived - Math.min(allTimeExpenses, allTimeReceived);

      // CYCLE stats
      const cycleReceived = funds.reduce((s,f) => s+(parseFloat(f.amount)||0), 0);
      const cycleExpensesTotal = expenses.reduce((s,e) => {
        if(e.category==='Manual Deduction') return s;
        return s+(parseFloat(e.amount)||0);
      }, 0);

      // Categorize cycle expenses
      const companyExp=[], riderDed=[];
      let totCompany=0, totDeductions=0, totManual=0;
      expenses.forEach(e => {
        const cat=(e.category||'').toLowerCase();
        const isMed=cat.includes('medical')||cat.includes('health');
        const isManual=e.category==='Manual Deduction';
        if(isMed||!(e.is_deductible===1||e.is_deductible===true)||!e.rider_id){
          companyExp.push(e);
          if(!isManual) totCompany+=parseFloat(e.amount)||0;
        } else {
          riderDed.push(e);
          if(!isManual) totDeductions+=parseFloat(e.amount)||0;
          else totManual+=parseFloat(e.amount)||0;
        }
      });

      // Calculate ALL-TIME pending deductions (debts persist regardless of cycle)
      const allPendingDeductions = [];
      allExpenses.forEach(e => {
        const cat=(e.category||'').toLowerCase();
        const isMed=cat.includes('medical')||cat.includes('health');
        if(!isMed && (e.is_deductible===1||e.is_deductible===true) && e.rider_id && !e.deductionSettled) {
          allPendingDeductions.push(e);
        }
      });

      const wb = new ExcelJS.Workbook();
      wb.creator='Inspiring Roads Logistics';

      // ══════════════════════════════════════
      // SHEET 1: DASHBOARD
      // ══════════════════════════════════════
      const ws1=wb.addWorksheet('Dashboard',{properties:{tabColor:{argb:'FF1E3A5F'}}});
      ws1.columns=[{width:40},{width:25},{width:5},{width:40},{width:25}];
      this.addHeader(ws1,'Financial Dashboard',periodLabel,5);

      let r=5;
      // ALL-TIME OVERVIEW
      this.sectionTitle(ws1,r,5,'📈 ALL-TIME FINANCIAL OVERVIEW', 'FFE0E7FF');r++;
      const allKpis=[
        ['Total Funds Received (All Time)',allTimeReceived,this.C.greenBg,this.C.green],
        ['Total Expenses (All Time)',allTimeExpenses,this.C.redBg,this.C.red],
        ['Remaining Company Balance',allTimeRemaining,allTimeRemaining>=0?this.C.greenBg:this.C.redBg,allTimeRemaining>=0?this.C.green:this.C.red],
        ['Out of Pocket (Abdullah)',allTimePocket>0?-allTimePocket:0,allTimePocket>0?this.C.redBg:this.C.greenBg,allTimePocket>0?this.C.red:this.C.green],
      ];
      allKpis.forEach(([label,val,bg,color])=>{
        const row=ws1.getRow(r); row.height=32;
        ws1.mergeCells(r,1,r,2);
        const lc=row.getCell(1);
        lc.value='   '+label; lc.font={name:'Calibri',bold:true,size:14}; lc.fill=this.fill(bg); lc.border=this.border; lc.alignment={vertical:'middle'};
        ws1.mergeCells(r,4,r,5);
        const vc=row.getCell(4);
        vc.value=val; vc.numFmt='#,##0.00 "SAR"';
        vc.font={name:'Calibri',bold:true,size:16,color:{argb:color}};
        vc.fill=this.fill(bg); vc.border=this.border; vc.alignment={vertical:'middle',horizontal:'right'};
        row.getCell(3).fill=this.fill(bg); row.getCell(3).border=this.border;
        r++;
      });

      if(!isAllTime){
        r+=2;
        this.sectionTitle(ws1,r,5,`📅 THIS CYCLE: ${periodLabel}`,'FFFEF3C7');r++;
        const cycKpis=[
          ['Funds Received This Cycle',cycleReceived,this.C.greenBg,this.C.green],
          ['Total Expenses This Cycle',cycleExpensesTotal,this.C.redBg,this.C.red],
          ['  - Company Paid',totCompany,this.C.light,this.C.muted],
          ['  - Rider Deductions (Cash)',totDeductions,this.C.light,this.C.muted],
          ['  - Manual Debts (Non-Cash)',totManual,this.C.amberBg,this.C.amber],
        ];
        cycKpis.forEach(([label,val,bg,color])=>{
          const row=ws1.getRow(r); row.height=28;
          ws1.mergeCells(r,1,r,2);
          const lc=row.getCell(1);
          lc.value=label.startsWith('  ')?label:'   '+label; lc.font={name:'Calibri',bold:!label.startsWith('  '),size:13}; lc.fill=this.fill(bg); lc.border=this.border; lc.alignment={vertical:'middle'};
          ws1.mergeCells(r,4,r,5);
          const vc=row.getCell(4);
          vc.value=val; vc.numFmt='#,##0.00 "SAR"'; vc.font={name:'Calibri',bold:true,size:14,color:{argb:color}}; vc.fill=this.fill(bg); vc.border=this.border; vc.alignment={vertical:'middle',horizontal:'right'};
          row.getCell(3).fill=this.fill(bg); row.getCell(3).border=this.border;
          r++;
        });
      }

      // CATEGORY BREAKDOWN
      r+=2;
      this.sectionTitle(ws1,r,5,'📊 EXPENSE BREAKDOWN BY CATEGORY', 'FFE0E7FF');r++;
      this.headerRow(ws1,r,['Category','','Count','','Total Amount']);
      ws1.mergeCells(r,1,r,2); ws1.mergeCells(r,3,r,4); r++;
      const catMap={};
      expenses.forEach(e=>{
        if(e.category==='Manual Deduction') return;
        const cat=e.category||'Other';
        if(!catMap[cat]) catMap[cat]={count:0,total:0};
        catMap[cat].count++; catMap[cat].total+=parseFloat(e.amount)||0;
      });
      const catStart=r;
      Object.keys(catMap).sort().forEach(cat=>{
        ws1.mergeCells(r,1,r,2); ws1.mergeCells(r,3,r,4);
        const row=ws1.getRow(r);
        row.getCell(1).value='   '+cat; row.getCell(1).font={name:'Calibri',size:12,bold:true};
        row.getCell(3).value=catMap[cat].count; row.getCell(3).alignment={horizontal:'center',vertical:'middle'}; row.getCell(3).font={size:12};
        row.getCell(5).value=catMap[cat].total; row.getCell(5).numFmt='#,##0.00 "SAR"'; row.getCell(5).alignment={horizontal:'right',vertical:'middle'}; row.getCell(5).font={size:13,bold:true};
        r++;
      });
      this.styleRows(ws1,catStart,r-1,5);

      // ══════════════════════════════════════
      // SHEET 2: EXPENSES BY CATEGORY
      // ══════════════════════════════════════
      const ws2=wb.addWorksheet('Expenses by Category',{properties:{tabColor:{argb:'FF2563EB'}}});
      ws2.columns=[{width:18},{width:24},{width:30},{width:16},{width:30}];
      this.addHeader(ws2,'All Expenses - Grouped by Category',periodLabel,5);

      r=5;
      const byCat={};
      companyExp.concat(riderDed).forEach(e=>{
        if(e.category==='Manual Deduction') return;
        const cat=e.category||'Other';
        if(!byCat[cat]) byCat[cat]=[];
        byCat[cat].push(e);
      });

      Object.keys(byCat).sort().forEach(cat=>{
        const items=byCat[cat];
        let catTotal=items.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

        // Category header
        this.sectionTitle(ws2,r,5,`${cat.toUpperCase()} (${items.length} entries)  -  Total: ${catTotal.toLocaleString('en-US',{minimumFractionDigits:2})} SAR`);
        r++;
        this.headerRow(ws2,r,['Date','Recipient / Vendor','Notes','Amount','Type']); r++;
        const grpStart=r;
        items.forEach(e=>{
          const row=ws2.getRow(r);
          row.getCell(1).value=e.expense_date?new Date(e.expense_date+'T00:00:00'):'';
          row.getCell(1).numFmt='MMM DD, YYYY';
          row.getCell(2).value=e.rider_name||e.vendor_name||'General';
          row.getCell(3).value=e.notes||'';
          row.getCell(4).value=parseFloat(e.amount)||0; row.getCell(4).numFmt='#,##0.00';
          row.getCell(4).alignment={horizontal:'right',vertical:'middle'};
          const isDed=e.is_deductible===1||e.is_deductible===true;
          let typeVal = 'Company Paid';
          if(isDed) typeVal = e.deductionSettled ? 'Already Deducted (Settled)' : 'Rider Deductible (Pending)';
          row.getCell(5).value=typeVal;
          row.getCell(5).font={name:'Calibri',size:11,color:{argb:isDed?(e.deductionSettled?this.C.green:this.C.amber):this.C.muted}};
          r++;
        });
        this.styleRows(ws2,grpStart,r-1,5);
        this.totalRow(ws2,r,5,`${cat} Total`,4,catTotal,this.C.blueBg);
        r+=2;
      });

      // ══════════════════════════════════════
      // SHEET 3: RIDER BREAKDOWN
      // ══════════════════════════════════════
      const ws3=wb.addWorksheet('Rider Breakdown',{properties:{tabColor:{argb:'FFD97706'}}});
      ws3.columns=[{width:20},{width:16},{width:18},{width:15},{width:15},{width:30}];
      this.addHeader(ws3,'Complete Rider Expense Breakdown',periodLabel,6);

      const riderGroups={};
      expenses.forEach(e=>{
        if(!e.rider_id) return;
        const name=e.rider_name||`Rider #${e.rider_id}`;
        if(!riderGroups[name]) riderGroups[name]=[];
        riderGroups[name].push(e);
      });

      r=5;
      Object.keys(riderGroups).sort().forEach(riderName=>{
        const items=riderGroups[riderName];
        let riderTotal=items.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

        ws3.mergeCells(r,1,r,6);
        const rh=ws3.getCell(`A${r}`);
        rh.value=`  ${riderName}  |  Total: ${riderTotal.toLocaleString('en-US',{minimumFractionDigits:2})} SAR`;
        rh.font={name:'Calibri',bold:true,size:13,color:{argb:this.C.white}};
        rh.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF334155'}};
        ws3.getRow(r).height=30; r++;

        this.headerRow(ws3,r,['Category','Date','Status','Deductible','Amount','Notes']); r++;
        const grpStart=r;
        items.forEach(e=>{
          const row=ws3.getRow(r);
          row.getCell(1).value=e.category||'Other';
          row.getCell(2).value=e.expense_date?new Date(e.expense_date+'T00:00:00'):'';
          row.getCell(2).numFmt='MMM DD, YYYY';
          const isDed=e.is_deductible===1||e.is_deductible===true;
          row.getCell(3).value=isDed?(e.deductionSettled?'Settled':'Pending'):'Company Paid';
          row.getCell(4).value=isDed?'Yes':'No';
          row.getCell(5).value=parseFloat(e.amount)||0; row.getCell(5).numFmt='#,##0.00';
          row.getCell(5).alignment={horizontal:'right',vertical:'middle'};
          row.getCell(6).value=e.notes||'';
          r++;
        });
        this.styleRows(ws3,grpStart,r-1,6);
        this.totalRow(ws3,r,6,`Subtotal: ${riderName}`,5,riderTotal,this.C.amberBg);
        r+=2;
      });

      // ══════════════════════════════════════
      // SHEET 4: PENDING DEDUCTIONS (ALWAYS ALL-TIME)
      // ══════════════════════════════════════
      const ws4=wb.addWorksheet('Pending Deductions',{properties:{tabColor:{argb:'FFDC2626'}}});
      ws4.columns=[{width:20},{width:22},{width:18},{width:18},{width:36}];
      this.addHeader(ws4,'Total Pending Rider Deductions - Awaiting Collection', 'All-Time (Cumulative Debt)',5);

      const pending=allPendingDeductions;
      r=5;

      const pendByRider={};
      pending.forEach(e=>{const n=e.rider_name||`Rider #${e.rider_id}`;if(!pendByRider[n])pendByRider[n]=[];pendByRider[n].push(e);});
      let grandPending=0;

      if(pending.length===0){
        ws4.mergeCells(r,1,r,5);
        ws4.getCell(`A${r}`).value='No pending deductions found for this period.';
        ws4.getCell(`A${r}`).font={name:'Calibri',italic:true,color:{argb:this.C.muted}};
      } else {
        Object.keys(pendByRider).sort().forEach(name=>{
          const items=pendByRider[name];
          let sub=items.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
          grandPending+=sub;

          // Rider Header
          this.sectionTitle(ws4,r,5,`👤 ${name.toUpperCase()}  -  Total Pending: ${sub.toLocaleString('en-US',{minimumFractionDigits:2})} SAR`, 'FFFEF2F2');
          ws4.getCell(`A${r}`).font={name:'Calibri',bold:true,size:12,color:{argb:'FF991B1B'}};
          r++;

          this.headerRow(ws4,r,['Date','Category','Status','Amount','Notes']); r++;
          const grpStart=r;

          items.forEach(e=>{
            const row=ws4.getRow(r);
            row.getCell(1).value=e.expense_date?new Date(e.expense_date+'T00:00:00'):'';
            row.getCell(1).numFmt='MMM DD, YYYY';
            row.getCell(2).value=e.category||'Other';
            row.getCell(3).value='Pending Collection';
            row.getCell(3).font={color:{argb:this.C.red}};
            row.getCell(4).value=parseFloat(e.amount)||0; row.getCell(4).numFmt='#,##0.00';
            row.getCell(4).alignment={horizontal:'right',vertical:'middle'};
            row.getCell(4).font={bold:true};
            row.getCell(5).value=e.notes||'';
            r++;
          });
          this.styleRows(ws4,grpStart,r-1,5);
          
          this.totalRow(ws4,r,5,`Pending for ${name}`,4,sub,this.C.redBg);
          r+=2;
        });

        // Grand total
        const gp=ws4.getRow(r); gp.height=36;
        ws4.mergeCells(r,1,r,3);
        gp.getCell(1).value='🚨 TOTAL OUTSTANDING DEDUCTIONS';
        gp.getCell(1).font={name:'Calibri',bold:true,size:15,color:{argb:this.C.white}};
        gp.getCell(1).alignment={horizontal:'right',vertical:'middle'};
        gp.getCell(1).fill=this.fill('FF991B1B'); gp.getCell(1).border=this.border;
        gp.getCell(4).value=grandPending; gp.getCell(4).numFmt='#,##0.00 "SAR"';
        gp.getCell(4).font={name:'Calibri',bold:true,size:16,color:{argb:this.C.white}};
        gp.getCell(4).fill=this.fill('FF991B1B'); gp.getCell(4).border=this.border;
        gp.getCell(4).alignment={horizontal:'right',vertical:'middle'};
        gp.getCell(5).fill=this.fill('FF991B1B'); gp.getCell(5).border=this.border;
      }

      ws4.autoFilter={from:'A5',to:`E${Math.max(r,6)}`};

      // ══════════════════════════════════════
      // SHEET 5: SETTLED DEDUCTIONS
      // ══════════════════════════════════════
      const ws5=wb.addWorksheet('Settled Deductions',{properties:{tabColor:{argb:'FF16A34A'}}});
      ws5.columns=[{width:24},{width:22},{width:16},{width:16},{width:16},{width:26}];
      this.addHeader(ws5,'Settled Rider Deductions - Already Collected',periodLabel,6);

      const settled=riderDed.filter(e=>e.deductionSettled);
      r=5;
      this.headerRow(ws5,r,['Rider Name','Category','Date','Amount','Settled By','Notes']); r++;
      const settStart=r;
      settled.forEach(e=>{
        const row=ws5.getRow(r);
        row.getCell(1).value=e.rider_name||`Rider #${e.rider_id}`;
        row.getCell(2).value=e.category||'Other';
        row.getCell(3).value=e.expense_date?new Date(e.expense_date+'T00:00:00'):'';
        row.getCell(3).numFmt='MMM DD, YYYY';
        row.getCell(4).value=parseFloat(e.amount)||0; row.getCell(4).numFmt='#,##0.00';
        row.getCell(4).alignment={horizontal:'right',vertical:'middle'};
        row.getCell(5).value=e.settledBy||'Payroll';
        row.getCell(6).value=e.notes||''; r++;
      });
      if(settled.length>0){
        this.styleRows(ws5,settStart,r-1,6);
        const totalSettled=settled.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        this.totalRow(ws5,r,6,'TOTAL SETTLED',4,totalSettled,this.C.greenBg);
      }
      ws5.autoFilter={from:'A5',to:`F${Math.max(r,6)}`};

      // ══════════════════════════════════════
      // SHEET 6: FUNDS RECEIVED
      // ══════════════════════════════════════
      const ws6=wb.addWorksheet('Funds Received',{properties:{tabColor:{argb:'FF059669'}}});
      ws6.columns=[{width:18},{width:32},{width:18},{width:32}];
      this.addHeader(ws6,'Funds Received from Company',periodLabel,4);

      r=5;
      this.headerRow(ws6,r,['Date','Source / Description','Amount','Notes']); r++;
      const fundsStart=r;
      funds.forEach(f=>{
        const row=ws6.getRow(r);
        row.getCell(1).value=f.receive_date?new Date(f.receive_date+'T00:00:00'):'';
        row.getCell(1).numFmt='MMM DD, YYYY';
        row.getCell(2).value=f.description||'Fund Transfer';
        row.getCell(3).value=parseFloat(f.amount)||0; row.getCell(3).numFmt='#,##0.00';
        row.getCell(3).alignment={horizontal:'right',vertical:'middle'};
        row.getCell(4).value=f.notes||''; r++;
      });
      if(funds.length>0){
        this.styleRows(ws6,fundsStart,r-1,4);
        this.totalRow(ws6,r,4,'TOTAL FUNDS RECEIVED',3,cycleReceived,this.C.greenBg);
      }
      ws6.autoFilter={from:'A5',to:`D${Math.max(r,6)}`};

      // ── DOWNLOAD ──
      const buffer=await wb.xlsx.writeBuffer();
      const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`IRL_Sponsor_Report_${periodLabel.replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`;
      document.body.appendChild(a); a.click();
      setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},200);

      Utils.showToast('Sponsor Excel Report downloaded!','success');
      Utils.hideLoading();
    } catch(err){
      console.error('Excel Error:',err);
      Utils.showToast('Failed: '+err.message,'error');
      Utils.hideLoading();
    }
  }
};
